"use client";

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TimetableBlock,
  TimetableBlockType,
  TimetableBuilderData,
  TimetableClassSummary,
  TimetableStaffOption
} from "@/lib/types";

type TimetableBuilderProps = {
  initialData: TimetableBuilderData;
};

type EditableBlockDraft = {
  blockId: string;
  targetBlockIds: string[];
  title: string;
  blockType: TimetableBlockType;
  color: string;
  staffIds: string[];
};

type MergedTimetableBlock = TimetableBlock & {
  mergedIds: string[];
};

type TimetableRowSegment = {
  key: string;
  startTime: string;
  endTime: string;
};

type ParentExportBlock = {
  id: string;
  title: string;
  dayKey: string;
  color: string | null;
  rowStart: number;
  rowEnd: number;
};

type ParentSharedBar = {
  id: string;
  title: string;
  color: string | null;
  rowStart: number;
  rowEnd: number;
  gridColumn: string;
};

type TimetableClassesResponse = {
  classes: TimetableClassSummary[];
};

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" }
] as const;

const COLOR_OPTIONS = [
  "#ffffff",
  "#8be6a8",
  "#a8c7f0",
  "#f4a7ff",
  "#ffe97c",
  "#efbadf",
  "#ffd090",
  "#f79ca1",
  "#76ddd1",
  "#7c3aed",
  "#1d4ed8",
  "#111827"
];

const BLOCK_TYPE_LABELS: Record<TimetableBlockType, string> = {
  lesson: "Lesson",
  break: "Break",
  lunch: "Lunch",
  dismissal: "Dismissal",
  assembly: "Assembly",
  other: "Other"
};

const PARENT_EXPORT_END_TIME = "15:00:00";
const STANDARD_PARENT_EXPORT_END_TIME = "12:00:00";
const MILEPOST_ONE_SUBJECTS = [
  "English",
  "Maths",
  "IPC",
  "Mandarin",
  "BM",
  "P.E.",
  "Coding",
  "Library",
  "Shared Reading",
  "Phonics",
  "Guided Reading",
  "Assembly",
  "Financial Literacy"
] as const;

const MILEPOST_ONE_MAINSTREAM_TARGETS: Record<(typeof MILEPOST_ONE_SUBJECTS)[number], number> = {
  English: 160,
  Maths: 240,
  IPC: 240,
  Mandarin: 120,
  BM: 120,
  "P.E.": 120,
  Coding: 40,
  Library: 40,
  "Shared Reading": 160,
  Phonics: 160,
  "Guided Reading": 160,
  Assembly: 40,
  "Financial Literacy": 40
};

const MILEPOST_ONE_BILINGUAL_TARGETS: Record<(typeof MILEPOST_ONE_SUBJECTS)[number], number> = {
  English: 240,
  Maths: 240,
  IPC: 240,
  Mandarin: 240,
  BM: 120,
  "P.E.": 120,
  Coding: 40,
  Library: 40,
  "Shared Reading": 160,
  Phonics: 160,
  "Guided Reading": 160,
  Assembly: 40,
  "Financial Literacy": 40
};

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function formatDisplayTime(value: string) {
  const [hour, minute] = value.split(":");
  return `${hour}:${minute}`;
}

function timeRangeLabel(startTime: string, endTime: string) {
  return `${formatDisplayTime(startTime)}-${formatDisplayTime(endTime)}`;
}

function initialsForTeacher(teacher: { staff_first_name: string | null; staff_name: string }) {
  const source = teacher.staff_first_name || teacher.staff_name;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function displayTeacherName(teacher: { staff_first_name: string | null; staff_name: string }) {
  return teacher.staff_first_name || teacher.staff_name;
}

function blockSignature(block: TimetableBlock) {
  const normalizedTitle = block.title?.trim() ?? "";
  if (!normalizedTitle) {
    return `${block.id}`;
  }

  const teacherIds = block.teachers
    .map((teacher) => teacher.staff_id)
    .sort()
    .join("|");

  return [
    normalizedTitle,
    block.block_type,
    block.color ?? "",
    teacherIds
  ].join("::");
}

function mergedBlocksForDay(blocks: TimetableBlock[]) {
  const sorted = [...blocks].sort((left, right) => left.sort_order - right.sort_order);
  const merged: MergedTimetableBlock[] = [];

  sorted.forEach((block) => {
    const current = merged[merged.length - 1];
    if (
      current &&
      blockSignature(current) === blockSignature(block) &&
      current.end_time === block.start_time
    ) {
      current.end_time = block.end_time;
      current.mergedIds.push(block.id);
      return;
    }

    merged.push({
      ...block,
      mergedIds: [block.id]
    });
  });

  return merged;
}

function buildTimetableRowSegments(blocks: TimetableBlock[]) {
  const boundaryValues = Array.from(
    new Set(blocks.flatMap((block) => [block.start_time, block.end_time]))
  ).sort((left, right) => minutesBetween("00:00:00", left) - minutesBetween("00:00:00", right));

  const segments: TimetableRowSegment[] = [];
  for (let index = 0; index < boundaryValues.length - 1; index += 1) {
    const startTime = boundaryValues[index];
    const endTime = boundaryValues[index + 1];
    segments.push({
      key: `${startTime}-${endTime}`,
      startTime,
      endTime
    });
  }

  return segments;
}

function buildStandardRowSegments(
  rowSegments: TimetableRowSegment[],
  isYearOneTwoTemplate: boolean
) {
  if (!isYearOneTwoTemplate) {
    return rowSegments;
  }

  const merged: TimetableRowSegment[] = [];
  let index = 0;

  while (index < rowSegments.length) {
    const segment = rowSegments[index];

    if (segment.startTime === "12:00:00") {
      merged.push({
        key: "12:00:00-12:20:00",
        startTime: "12:00:00",
        endTime: "12:20:00"
      });

      while (index < rowSegments.length && rowSegments[index].endTime <= "12:20:00") {
        index += 1;
      }
      continue;
    }

    merged.push(segment);
    index += 1;
  }

  return merged;
}

function textColorForBackground(color: string | null) {
  const hex = (color ?? "").replace("#", "");
  if (hex.length !== 6) {
    return "#261718";
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance < 0.52 ? "#fffdf8" : "#261718";
}

function labelForBlock(block: TimetableBlock) {
  return block.title?.trim() || block.period_label;
}

function blockDensityClass(block: TimetableBlock) {
  const minutes = minutesBetween(block.start_time, block.end_time);
  if (minutes <= 20) {
    return "is-tight";
  }
  if (minutes <= 40) {
    return "is-compact";
  }
  return "";
}

function isBreakOrLunchType(blockType: TimetableBlockType) {
  return blockType === "break" || blockType === "lunch";
}

function isParentFillCandidate(block: MergedTimetableBlock) {
  const label = labelForBlock(block).trim();
  if (isBreakOrLunchType(block.block_type) || block.block_type === "dismissal") {
    return false;
  }

  return !/pastoral/i.test(label);
}

function normalizeLabelForCompare(value: string) {
  return value.trim().toLowerCase();
}

function isMilepostOneYearGroup(yearGroup: string) {
  const normalized = normalizeLabelForCompare(yearGroup);
  return normalized === "year 1" || normalized === "year 2";
}

function subjectMatchesBlockTitle(subject: string, title: string) {
  const normalizedTitle = normalizeLabelForCompare(title);

  switch (subject) {
    case "BM":
      return (
        normalizedTitle.includes("bm") ||
        normalizedTitle.includes("bahasa melayu")
      );
    case "P.E.":
      return normalizedTitle.includes("p.e.") || normalizedTitle.includes("pe");
    default:
      return normalizedTitle.includes(normalizeLabelForCompare(subject));
  }
}

function daySpecificParentEndTime(dayKey: string, templateName: string | undefined) {
  const normalizedTemplateName = normalizeLabelForCompare(templateName ?? "");
  const isYearOneTwoTemplate =
    normalizedTemplateName.includes("year 1") && normalizedTemplateName.includes("year 2");

  if (isYearOneTwoTemplate && dayKey === "friday") {
    return STANDARD_PARENT_EXPORT_END_TIME;
  }

  return PARENT_EXPORT_END_TIME;
}

function standardDisplayBlockTimes(
  block: MergedTimetableBlock,
  isYearOneTwoTemplate: boolean
) {
  if (
    isYearOneTwoTemplate &&
    block.weekday === "friday" &&
    block.block_type === "dismissal" &&
    block.start_time === "12:00:00" &&
    block.end_time === "12:15:00"
  ) {
    return {
      startTime: "12:00:00",
      endTime: "12:20:00"
    };
  }

  return {
    startTime: block.start_time,
    endTime: block.end_time
  };
}

function buildParentRowSegments(
  rowSegments: TimetableRowSegment[],
  isYearOneTwoTemplate: boolean
) {
  if (!isYearOneTwoTemplate) {
    return rowSegments.filter(
      (segment) => segment.startTime < PARENT_EXPORT_END_TIME && segment.endTime <= PARENT_EXPORT_END_TIME
    );
  }

  const filtered = rowSegments.filter(
    (segment) => segment.startTime < PARENT_EXPORT_END_TIME && segment.endTime <= PARENT_EXPORT_END_TIME
  );

  const merged: TimetableRowSegment[] = [];
  let index = 0;

  while (index < filtered.length) {
    const segment = filtered[index];

    if (segment.startTime === "14:20:00") {
      merged.push({
        key: "14:20:00-15:00:00",
        startTime: "14:20:00",
        endTime: "15:00:00"
      });

      while (index < filtered.length && filtered[index].endTime <= "15:00:00") {
        index += 1;
      }
      continue;
    }

    if (segment.startTime === "12:00:00") {
      merged.push({
        key: "12:00:00-12:20:00",
        startTime: "12:00:00",
        endTime: "12:20:00"
      });

      while (index < filtered.length && filtered[index].endTime <= "12:20:00") {
        index += 1;
      }
      continue;
    }

    merged.push(segment);
    index += 1;
  }

  return merged;
}

export function TimetableBuilder({ initialData }: TimetableBuilderProps) {
  const router = useRouter();
  const standardExportRef = useRef<HTMLDivElement | null>(null);
  const parentExportRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState(initialData);
  const [classOptions, setClassOptions] = useState<TimetableClassSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialData.timetable?.template_id ?? initialData.templates[0]?.id ?? "");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableBlockDraft | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isDeletingTimetable, setIsDeletingTimetable] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState<"standard" | "parent" | null>(null);

  useEffect(() => {
    setData(initialData);
    setSelectedTemplateId(initialData.timetable?.template_id ?? initialData.templates[0]?.id ?? "");
    setSelectedTeacherId("");
    setSelectedBlockId(null);
    setDraft(null);
    setStatus("");
    setError("");
  }, [initialData]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/timetables/classes", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const json = (await response.json()) as TimetableClassesResponse;
      setClassOptions(json.classes);
    })();
  }, []);

  const normalizedTemplateName = useMemo(
    () => normalizeLabelForCompare(data.timetable?.template_name ?? ""),
    [data.timetable?.template_name]
  );
  const isMilepostOneTimetable = useMemo(
    () => isMilepostOneYearGroup(data.classSummary.yearGroup),
    [data.classSummary.yearGroup]
  );
  const isMainstreamTimetable = useMemo(
    () => normalizeLabelForCompare(data.classSummary.designation) === "mainstream",
    [data.classSummary.designation]
  );
  const isBilingualTimetable = useMemo(
    () => normalizeLabelForCompare(data.classSummary.designation) === "bilingual",
    [data.classSummary.designation]
  );
  const isYearOneTwoTemplate = useMemo(
    () => normalizedTemplateName.includes("year 1") && normalizedTemplateName.includes("year 2"),
    [normalizedTemplateName]
  );
  const rowSegments = useMemo(
    () => buildStandardRowSegments(buildTimetableRowSegments(data.blocks), isYearOneTwoTemplate),
    [data.blocks, isYearOneTwoTemplate]
  );
  const parentRowSegments = useMemo(
    () => buildParentRowSegments(rowSegments, isYearOneTwoTemplate),
    [isYearOneTwoTemplate, rowSegments]
  );
  const rowLineByTime = useMemo(
    () => new Map(rowSegments.flatMap((segment, index) => [[segment.startTime, index + 1], [segment.endTime, index + 2]])),
    [rowSegments]
  );
  const parentRowLineByTime = useMemo(
    () =>
      new Map(
        parentRowSegments.flatMap((segment, index) => [
          [segment.startTime, index + 1],
          [segment.endTime, index + 2]
        ])
      ),
    [parentRowSegments]
  );

  const dayColumns = useMemo(
    () =>
      WEEKDAYS.map((day) => {
        const dayBlocks = data.blocks.filter((block) => block.weekday === day.key);
        return {
          ...day,
          blocks: mergedBlocksForDay(dayBlocks)
        };
      }),
    [data.blocks]
  );

  const visibleBlocks = useMemo(
    () => dayColumns.flatMap((day) => day.blocks),
    [dayColumns]
  );
  const assignedTeacherOptions = useMemo(() => {
    const teacherMap = new Map<string, TimetableStaffOption>();

    data.blocks.forEach((block) => {
      block.teachers.forEach((teacher) => {
        const matchingOption = data.staffOptions.find((option) => option.id === teacher.staff_id);
        if (matchingOption) {
          teacherMap.set(matchingOption.id, matchingOption);
        }
      });
    });

    return Array.from(teacherMap.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [data.blocks, data.staffOptions]);
  const curriculumChecks = useMemo(() => {
    if (!isMilepostOneTimetable || (!isMainstreamTimetable && !isBilingualTimetable)) {
      return [];
    }

    const targetSet = isBilingualTimetable
      ? MILEPOST_ONE_BILINGUAL_TARGETS
      : MILEPOST_ONE_MAINSTREAM_TARGETS;

    const totals = new Map<string, number>(
      MILEPOST_ONE_SUBJECTS.map((subject) => [subject, 0])
    );

    data.blocks.forEach((block) => {
      const title = labelForBlock(block);
      const minutes = minutesBetween(block.start_time, block.end_time);
      if (!title.trim() || minutes <= 0) {
        return;
      }

      MILEPOST_ONE_SUBJECTS.forEach((subject) => {
        if (subjectMatchesBlockTitle(subject, title)) {
          totals.set(subject, (totals.get(subject) ?? 0) + minutes);
        }
      });
    });

    return MILEPOST_ONE_SUBJECTS.map((subject) => {
      const actualMinutes = totals.get(subject) ?? 0;
      const targetMinutes = targetSet[subject];

      return {
        subject,
        actualMinutes,
        targetMinutes,
        matches: actualMinutes === targetMinutes
      };
    });
  }, [data.blocks, isBilingualTimetable, isMainstreamTimetable, isMilepostOneTimetable]);
  const parentGridData = useMemo(() => {
    const sharedBars: ParentSharedBar[] = [];
    const blocks: ParentExportBlock[] = [];

    if (isYearOneTwoTemplate) {
      const lunchSource = dayColumns
        .filter((day) => day.key !== "friday")
        .flatMap((day) => day.blocks)
        .find(
          (block) =>
            block.block_type === "lunch" &&
            block.start_time <= "11:40:00" &&
            block.end_time >= "12:20:00"
        );

      if (lunchSource) {
        const lunchRowStart = (parentRowLineByTime.get("11:40:00") ?? 1) + 1;
        const lunchRowEnd = (parentRowLineByTime.get("12:00:00") ?? lunchRowStart) + 1;

        if (lunchRowEnd > lunchRowStart) {
          sharedBars.push({
            id: "shared-lunch-mon-thu",
            title: "Lunchtime",
            color: lunchSource.color,
            rowStart: lunchRowStart,
            rowEnd: lunchRowEnd,
            gridColumn: "2 / 6"
          });
        }
      }

      const playtimeRowStart = (parentRowLineByTime.get("12:00:00") ?? 1) + 1;
      const playtimeRowEnd = (parentRowLineByTime.get("12:20:00") ?? playtimeRowStart) + 1;

      if (playtimeRowEnd > playtimeRowStart) {
        sharedBars.push({
          id: "shared-playtime-mon-thu",
          title: "Playtime",
          color: "#9ca3af",
          rowStart: playtimeRowStart,
          rowEnd: playtimeRowEnd,
          gridColumn: "2 / 6"
        });
      }
    }

    const sharedSegments = parentRowSegments.map((segment) => {
      const coveringBlocks = dayColumns.map((day) =>
        day.blocks.find(
          (block) => block.start_time <= segment.startTime && block.end_time >= segment.endTime
        ) ?? null
      );

      const reference = coveringBlocks[0];
      if (!reference || !isBreakOrLunchType(reference.block_type)) {
        return null;
      }

      const allMatch = coveringBlocks.every((block) => {
        if (!block) {
          return false;
        }

        return (
          block.block_type === reference.block_type &&
          labelForBlock(block).trim() === labelForBlock(reference).trim()
        );
      });

      if (!allMatch) {
        return null;
      }

      return {
        title: labelForBlock(reference),
        color: reference.color,
        blockType: reference.block_type
      };
    });

    let sharedIndex = 0;
    while (sharedIndex < sharedSegments.length) {
      const segment = sharedSegments[sharedIndex];
      if (!segment) {
        sharedIndex += 1;
        continue;
      }

      let endIndex = sharedIndex + 1;
      while (
        endIndex < sharedSegments.length &&
        sharedSegments[endIndex] &&
        sharedSegments[endIndex]?.title === segment.title &&
        sharedSegments[endIndex]?.blockType === segment.blockType
      ) {
        endIndex += 1;
      }

      sharedBars.push({
        id: `shared-${sharedIndex}`,
        title: segment.title,
        color: segment.color,
        rowStart: sharedIndex + 2,
        rowEnd: endIndex + 2,
        gridColumn: "2 / 7"
      });

      sharedIndex = endIndex;
    }

    dayColumns.forEach((day) => {
      const dayParentEndTime = daySpecificParentEndTime(day.key, data.timetable?.template_name);
      const clippedBlocks: MergedTimetableBlock[] = [];

      day.blocks.forEach((block) => {
        if (block.start_time >= dayParentEndTime) {
          return;
        }

        const clippedEndTime =
          block.end_time > dayParentEndTime ? dayParentEndTime : block.end_time;

        clippedBlocks.push({
          ...block,
          end_time: clippedEndTime
        });
      });

      if (isYearOneTwoTemplate && day.key !== "tuesday" && day.key !== "friday") {
        const rowStartsAt1420 = clippedBlocks.filter((block) => block.start_time >= "14:20:00");
        const dismissalSource =
          rowStartsAt1420.find((block) => block.block_type === "dismissal") ??
          rowStartsAt1420.find((block) => /dismissal/i.test(labelForBlock(block)));
        const fallbackBlock = dismissalSource ?? clippedBlocks[clippedBlocks.length - 1];

        if (rowStartsAt1420.length && fallbackBlock) {
          const keptBlocks = clippedBlocks.filter((block) => block.start_time < "14:20:00");
          clippedBlocks.length = 0;
          clippedBlocks.push(...keptBlocks);
          clippedBlocks.push({
            ...fallbackBlock,
            id: `${day.key}-parent-dismissal`,
            title: "Dismissal",
            period_label: "Dismissal",
            block_type: "dismissal",
            start_time: "14:20:00",
            end_time: PARENT_EXPORT_END_TIME,
            mergedIds: dismissalSource?.mergedIds ?? []
          });
        }
      } else if (!(isYearOneTwoTemplate && day.key === "friday")) {
        const lastFillCandidate = [...clippedBlocks]
          .reverse()
          .find((block) => isParentFillCandidate(block) && block.end_time <= dayParentEndTime);

        if (lastFillCandidate && lastFillCandidate.end_time < dayParentEndTime) {
          clippedBlocks.push({
            ...lastFillCandidate,
            id: `${lastFillCandidate.id}-parent-fill`,
            start_time: lastFillCandidate.end_time,
            end_time: dayParentEndTime,
            mergedIds: [...lastFillCandidate.mergedIds]
          });
        }
      }

      clippedBlocks
        .filter((block) => !isBreakOrLunchType(block.block_type))
        .forEach((block) => {
          const rowStart = (parentRowLineByTime.get(block.start_time) ?? 1) + 1;
          const rowEnd = (parentRowLineByTime.get(block.end_time) ?? rowStart) + 1;
          if (rowEnd <= rowStart) {
            return;
          }

          blocks.push({
            id: `${day.key}-${block.id}`,
            title: labelForBlock(block),
            dayKey: day.key,
            color: block.color,
            rowStart,
            rowEnd
          });
        });
    });

    return { blocks, sharedBars };
  }, [dayColumns, isYearOneTwoTemplate, parentRowLineByTime, parentRowSegments]);

  const selectedBlock = selectedBlockId
    ? visibleBlocks.find((block) => block.id === selectedBlockId) ?? null
    : null;

  async function refreshBuilderData() {
    const response = await fetch(
      `/api/timetables/${encodeURIComponent(data.classSummary.classCode)}`,
      { cache: "no-store" }
    );

    const json = (await response.json()) as TimetableBuilderData & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "Could not load timetable.");
    }

    setData(json);
    return json;
  }

  async function createTimetable() {
    if (!selectedTemplateId) {
      setError("Choose a timetable template first.");
      return;
    }

    setIsBusy(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/timetables/${encodeURIComponent(data.classSummary.classCode)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: selectedTemplateId
        })
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not create timetable.");
      }

      await refreshBuilderData();
      setStatus("Timetable created. You can now fill in each block.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create timetable.");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteTimetable() {
    setIsDeletingTimetable(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/timetables/${encodeURIComponent(data.classSummary.classCode)}`, {
        method: "DELETE"
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not delete timetable.");
      }

      router.push("/timetables");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete timetable.");
      setIsDeletingTimetable(false);
    }
  }

  function openEditor(block: MergedTimetableBlock) {
    setSelectedBlockId(block.id);
    setDraft({
      blockId: block.id,
      targetBlockIds: block.mergedIds,
      title: block.title ?? "",
      blockType: block.block_type,
      color: block.color ?? "#8be6a8",
      staffIds: block.teachers.map((teacher) => teacher.staff_id)
    });
  }

  async function saveBlock() {
    if (!draft) {
      return;
    }

    setIsBusy(true);
    setStatus("");
    setError("");

    try {
      for (const targetBlockId of draft.targetBlockIds) {
        const response = await fetch(
          `/api/timetables/${encodeURIComponent(data.classSummary.classCode)}/blocks`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              blockId: targetBlockId,
              title: draft.title,
              blockType: draft.blockType,
              color: draft.color,
              staffIds: draft.staffIds
            })
          }
        );

        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Could not save timetable block.");
        }
      }

      await refreshBuilderData();
      setSelectedBlockId(null);
      setDraft(null);
      setStatus("Lesson block saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save timetable block.");
    } finally {
      setIsBusy(false);
    }
  }

  async function resetBlock() {
    if (!selectedBlock || !draft) {
      return;
    }

    setIsBusy(true);
    setStatus("");
    setError("");

    try {
      for (const targetBlockId of draft.targetBlockIds) {
        const response = await fetch(
          `/api/timetables/${encodeURIComponent(data.classSummary.classCode)}/blocks/${encodeURIComponent(targetBlockId)}`,
          {
            method: "DELETE"
          }
        );

        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Could not reset timetable block.");
        }
      }

      await refreshBuilderData();
      setSelectedBlockId(null);
      setDraft(null);
      setStatus("Lesson block reset to the template default.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset timetable block.");
    } finally {
      setIsBusy(false);
    }
  }

  async function exportSurfaceAsPng(
    variant: "standard" | "parent",
    target: HTMLDivElement | null,
    filenameSuffix: string,
    successMessage: string
  ) {
    if (!target) {
      return;
    }

    setIsExportingImage(variant);
    setStatus("");
    setError("");

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      const dataUrl = await toPng(target, {
        cacheBust: true,
        backgroundColor: "#fffdf8",
        pixelRatio: 2
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${data.classSummary.className.replace(/\s+/g, "-").toLowerCase()}-${filenameSuffix}.png`;
      link.click();
      setStatus(successMessage);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export PNG.");
    } finally {
      setIsExportingImage(null);
    }
  }

  async function exportParentPdfFile() {
    if (!parentExportRef.current) {
      return;
    }

    setIsExportingImage("parent");
    setStatus("");
    setError("");

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      const dataUrl = await toPng(parentExportRef.current, {
        cacheBust: true,
        backgroundColor: "#fffdf8",
        pixelRatio: 2
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const image = new Image();
      const imageLoaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not prepare the parent timetable PDF image."));
      });
      image.src = dataUrl;
      await imageLoaded;

      const imageRatio = image.width / image.height;
      let renderWidth = usableWidth;
      let renderHeight = renderWidth / imageRatio;

      if (renderHeight > usableHeight) {
        renderHeight = usableHeight;
        renderWidth = renderHeight * imageRatio;
      }

      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;

      pdf.addImage(dataUrl, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
      pdf.save(`${data.classSummary.className.replace(/\s+/g, "-").toLowerCase()}-parent-timetable.pdf`);
      setStatus("Parent timetable PDF downloaded.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export parent PDF.");
    } finally {
      setIsExportingImage(null);
    }
  }

  async function exportStandardPng() {
    await exportSurfaceAsPng(
      "standard",
      standardExportRef.current,
      "timetable",
      "Timetable PNG downloaded."
    );
  }

  async function exportParentPng() {
    await exportSurfaceAsPng(
      "parent",
      parentExportRef.current,
      "parent-timetable",
      "Parent timetable PNG downloaded."
    );
  }

  function exportStandardPdf() {
    document.body.dataset.printVariant = "standard";
    const resetPrintVariant = () => {
      delete document.body.dataset.printVariant;
      window.removeEventListener("afterprint", resetPrintVariant);
    };
    window.addEventListener("afterprint", resetPrintVariant);
    setStatus("Print dialog opened. Choose Save as PDF to download.");
    setError("");
    window.print();
  }

  function exportParentPdf() {
    document.body.dataset.printVariant = "parent";
    const resetPrintVariant = () => {
      delete document.body.dataset.printVariant;
      window.removeEventListener("afterprint", resetPrintVariant);
    };
    window.addEventListener("afterprint", resetPrintVariant);
    setStatus("Parent print dialog opened. Choose Save as PDF to download.");
    setError("");
    window.print();
  }

  function updateTeacher(index: number, staffId: string) {
    if (!draft) {
      return;
    }

    const nextStaffIds = [...draft.staffIds];
    if (!staffId) {
      nextStaffIds.splice(index, 1);
    } else {
      nextStaffIds[index] = staffId;
    }

    setDraft({
      ...draft,
      staffIds: Array.from(new Set(nextStaffIds.filter(Boolean)))
    });
  }

  function addTeacher(staffId: string) {
    if (!draft || !staffId) {
      return;
    }

    setDraft({
      ...draft,
      staffIds: Array.from(new Set([...draft.staffIds, staffId]))
    });
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Timetable builder</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">{data.classSummary.className} Weekly Timetable</h1>
            <p className="hero-copy">
              {data.classSummary.school} | {data.classSummary.designation} | {data.classSummary.yearGroup}
            </p>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link className="button secondary" href="/timetables">
              Back to Timetables
            </Link>
            {data.timetable ? (
              <button
                className="button secondary"
                type="button"
                disabled={isDeletingTimetable}
                onClick={() => void deleteTimetable()}
              >
                {isDeletingTimetable ? "Deleting..." : "Delete Timetable"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="timetable-toolbar">
          <div className="field">
            <label htmlFor="timetableClassSelect">Class</label>
            <select
              id="timetableClassSelect"
              value={data.classSummary.classCode}
              onChange={(event) => router.push(`/timetables/${encodeURIComponent(event.target.value)}`)}
            >
              <option value={data.classSummary.classCode}>{data.classSummary.className}</option>
              {classOptions
                .filter((entry) => entry.classCode !== data.classSummary.classCode)
                .map((entry) => (
                  <option key={entry.classCode} value={entry.classCode}>
                    {entry.className}
                  </option>
                ))}
            </select>
          </div>
          {data.timetable ? (
            <>
              <div className="field">
                <label htmlFor="teacherFilter">Teacher</label>
                <select
                  id="teacherFilter"
                  value={selectedTeacherId}
                  onChange={(event) => setSelectedTeacherId(event.target.value)}
                >
                  <option value="">All assigned teachers</option>
                  {assignedTeacherOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="actions timetable-toolbar-actions">
                <button className="button secondary" type="button" onClick={() => exportStandardPdf()}>
                  Export PDF
                </button>
                <button className="button secondary" type="button" onClick={() => void exportStandardPng()} disabled={isExportingImage !== null}>
                  {isExportingImage === "standard" ? "Exporting..." : "Export PNG"}
                </button>
                <button className="button secondary" type="button" onClick={() => void exportParentPdfFile()} disabled={isExportingImage !== null}>
                  Parent PDF
                </button>
                <button className="button secondary" type="button" onClick={() => void exportParentPng()} disabled={isExportingImage !== null}>
                  {isExportingImage === "parent" ? "Exporting..." : "Parent PNG"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="builderTemplateSelect">Template</label>
                <select
                  id="builderTemplateSelect"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                >
                  <option value="">Select template</option>
                  {data.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.year_group ? ` | ${template.year_group}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field timetable-toolbar-summary">
                <label>Status</label>
                <div className="timetable-toolbar-value">No timetable created yet</div>
              </div>
              <div className="actions timetable-toolbar-actions">
                <button className="button" type="button" onClick={() => void createTimetable()} disabled={isBusy}>
                  {isBusy ? "Creating..." : "Create Timetable"}
                </button>
              </div>
            </>
          )}
        </div>

        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title">Subject Allocation</h2>
            <p className="meta">
              {isMilepostOneTimetable && (isMainstreamTimetable || isBilingualTimetable)
                ? `Milepost 1 ${isBilingualTimetable ? "Bilingual" : "Mainstream"} allocation check. Mixed labels count their full time toward each subject.`
                : "Allocation checks are currently configured for Milepost 1 Mainstream and Bilingual only."}
            </p>
          </div>
        </div>

        {isMilepostOneTimetable && (isMainstreamTimetable || isBilingualTimetable) ? (
          <div className="subject-check-row">
            {curriculumChecks.map((entry) => (
              <div className="subject-check-card" key={entry.subject}>
                <p className="subject-check-label">{entry.subject}</p>
                <p
                  className={`subject-check-icon ${entry.matches ? "match" : "mismatch"}`}
                  title={`${entry.subject}: ${entry.actualMinutes} / ${entry.targetMinutes} minutes`}
                  aria-label={`${entry.subject} ${entry.matches ? "matches" : "does not match"} target`}
                >
                  {entry.matches ? "✓" : "✕"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            This timetable is not in Milepost 1 Mainstream or Bilingual, so these allocation checks are not shown yet.
          </div>
        )}
      </section>

      <section className="panel">
        {data.timetable ? (
          <div className="timetable-board-scroll">
            <div
              className={`timetable-export-surface${isExportingImage === "standard" ? " is-export-clean" : ""}`}
              ref={standardExportRef}
            >
              <div className="timetable-export-bar">
                <div className="timetable-export-class">
                  <strong>{data.classSummary.className}</strong>
                  <span>
                    {data.classSummary.school} | {data.classSummary.designation} | {data.classSummary.yearGroup}
                  </span>
                </div>
                <div className="timetable-export-template">{data.timetable.template_name}</div>
              </div>

              <div className="timetable-master-grid">
                <div className="timetable-corner-cell" />

                {WEEKDAYS.map((day, dayIndex) => (
                  <div
                    className="timetable-day-header timetable-grid-header"
                    key={day.key}
                    style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                  >
                    {day.label}
                  </div>
                ))}

                {rowSegments.map((segment, segmentIndex) => (
                  <div
                    className="timetable-time-label"
                    key={segment.key}
                    style={{ gridColumn: 1, gridRow: segmentIndex + 2 }}
                  >
                    <span>{timeRangeLabel(segment.startTime, segment.endTime)}</span>
                  </div>
                ))}

                {WEEKDAYS.flatMap((day, dayIndex) =>
                  rowSegments.map((segment, segmentIndex) => (
                    <div
                      className="timetable-grid-slot"
                      key={`${day.key}-${segment.key}`}
                      style={{ gridColumn: dayIndex + 2, gridRow: segmentIndex + 2 }}
                    />
                  ))
                )}

                {dayColumns.flatMap((day, dayIndex) =>
                  day.blocks.map((block) => {
                    const background = block.color ?? "#8be6a8";
                    const foreground = textColorForBackground(background);
                    const displayTimes = standardDisplayBlockTimes(block, isYearOneTwoTemplate);
                    const rowStart = (rowLineByTime.get(displayTimes.startTime) ?? 1) + 1;
                    const rowEnd = (rowLineByTime.get(displayTimes.endTime) ?? rowStart) + 1;
                    const isTeacherMatch =
                      !selectedTeacherId ||
                      block.teachers.some((teacher) => teacher.staff_id === selectedTeacherId);
                    const visibleTeachers = selectedTeacherId
                      ? block.teachers.filter((teacher) => teacher.staff_id === selectedTeacherId)
                      : block.teachers;

                    return (
                      <button
                        key={block.id}
                        className={`timetable-block-card timetable-grid-block ${blockDensityClass(block)}${!isTeacherMatch ? " is-muted" : ""}`.trim()}
                        type="button"
                        style={{
                          gridColumn: dayIndex + 2,
                          gridRow: `${rowStart} / ${rowEnd}`,
                          background,
                          color: foreground
                        }}
                        onClick={() => openEditor(block)}
                      >
                        <div className="timetable-block-topline">
                          <strong>{labelForBlock(block)}</strong>
                          <span className="timetable-block-edit">✎</span>
                        </div>
                        <div className="timetable-block-meta">
                          {timeRangeLabel(displayTimes.startTime, displayTimes.endTime)}
                        </div>
                        <div className="timetable-block-meta muted-block-meta">
                          {BLOCK_TYPE_LABELS[block.block_type]}
                        </div>
                        {visibleTeachers.length ? (
                          <div className="timetable-teacher-strip">
                            {visibleTeachers.map((teacher) => (
                              <span className="timetable-teacher-badge" key={`${block.id}-${teacher.staff_id}`}>
                                {initialsForTeacher(teacher)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="timetable-parent-export-shell" aria-hidden="true">
              <div className="timetable-parent-export-surface" ref={parentExportRef}>
                <div className="timetable-parent-header">
                  <img
                    src="/help-international-school-logo.png"
                    alt="HELP International School logo"
                    className="timetable-parent-logo"
                  />
                  <h2 className="timetable-parent-title">{data.classSummary.className}</h2>
                </div>

                <div className="timetable-parent-grid">
                  <div className="timetable-parent-corner" />

                  {WEEKDAYS.map((day, dayIndex) => (
                    <div
                      className="timetable-parent-day"
                      key={`parent-${day.key}`}
                      style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                    >
                      {day.label}
                    </div>
                  ))}

                  {parentRowSegments.map((segment, segmentIndex) => (
                    <div
                      className="timetable-parent-time"
                      key={`parent-time-${segment.key}`}
                      style={{ gridColumn: 1, gridRow: segmentIndex + 2 }}
                    >
                      {timeRangeLabel(segment.startTime, segment.endTime)}
                    </div>
                  ))}

                  {WEEKDAYS.flatMap((day, dayIndex) =>
                    parentRowSegments.map((segment, segmentIndex) => (
                      <div
                        className="timetable-parent-slot"
                        key={`parent-slot-${day.key}-${segment.key}`}
                        style={{ gridColumn: dayIndex + 2, gridRow: segmentIndex + 2 }}
                      />
                    ))
                  )}

                  {parentGridData.sharedBars.map((bar) => (
                    <div
                      className="timetable-parent-shared-bar"
                      key={bar.id}
                      style={{
                        gridColumn: bar.gridColumn,
                        gridRow: `${bar.rowStart} / ${bar.rowEnd}`,
                        background: bar.color ?? "#7c8596"
                      }}
                    >
                      {bar.title}
                    </div>
                  ))}

                  {parentGridData.blocks.map((block) => {
                    const dayIndex = WEEKDAYS.findIndex((day) => day.key === block.dayKey);

                    return (
                      <div
                        className="timetable-parent-block"
                        key={block.id}
                        style={{
                          gridColumn: dayIndex + 2,
                          gridRow: `${block.rowStart} / ${block.rowEnd}`,
                          background: block.color ?? "#8be6a8",
                          color: textColorForBackground(block.color ?? "#8be6a8")
                        }}
                      >
                        {block.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Choose a template above and create this timetable before editing lesson blocks.
          </div>
        )}
      </section>

      {selectedBlock && draft ? (
        <div className="directory-modal-backdrop" role="presentation" onClick={() => setSelectedBlockId(null)}>
          <section
            className="directory-modal timetable-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="timetable-block-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="directory-modal-close" type="button" onClick={() => setSelectedBlockId(null)}>
              ×
            </button>

            <div className="directory-modal-header">
              <div>
                <h2 id="timetable-block-modal-title" className="directory-modal-title">
                  Edit block
                </h2>
                <p className="meta">
                  {selectedBlock.period_label} | {selectedBlock.start_time} - {selectedBlock.end_time}
                </p>
              </div>
            </div>

            <div className="timetable-editor-grid">
              <div className="field">
                <label htmlFor="blockTitle">Lesson / label</label>
                <input
                  id="blockTitle"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="e.g. Mandarin"
                />
              </div>

              <div className="field">
                <label htmlFor="blockType">Block type</label>
                <select
                  id="blockType"
                  value={draft.blockType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      blockType: event.target.value as TimetableBlockType
                    })
                  }
                >
                  {Object.entries(BLOCK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="timetable-time-row">
                <div className="field">
                  <label>Start</label>
                  <input value={selectedBlock.start_time} readOnly />
                </div>
                <div className="field">
                  <label>End</label>
                  <input value={selectedBlock.end_time} readOnly />
                </div>
              </div>

              <div className="field">
                <label>Color</label>
                <div className="timetable-color-grid">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`timetable-color-swatch${draft.color === color ? " active" : ""}`}
                      style={{ background: color }}
                      onClick={() => setDraft({ ...draft, color })}
                    >
                      <span className="sr-only">{color}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Teachers</label>
                <div className="timetable-teacher-editor">
                  {draft.staffIds.map((staffId, index) => (
                    <div className="timetable-teacher-row" key={`${draft.blockId}-${staffId}-${index}`}>
                      <select value={staffId} onChange={(event) => updateTeacher(index, event.target.value)}>
                        <option value="">None</option>
                        {data.staffOptions.map((option: TimetableStaffOption) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={draft.staffIds.includes(option.id) && option.id !== staffId}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button className="directory-action close" type="button" onClick={() => updateTeacher(index, "")}>
                        Remove
                      </button>
                    </div>
                  ))}

                  <div className="timetable-teacher-row">
                    <select value="" onChange={(event) => addTeacher(event.target.value)}>
                      <option value="">Add teacher</option>
                      {data.staffOptions
                        .filter((option) => !draft.staffIds.includes(option.id))
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedBlock.teachers.length ? (
                <div className="timetable-assigned-strip">
                  {selectedBlock.teachers.map((teacher) => (
                    <div className="directory-duty-pill" key={`${selectedBlock.id}-${teacher.staff_id}`}>
                      {displayTeacherName(teacher)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="directory-modal-actions">
              <button className="directory-action edit" type="button" onClick={() => void saveBlock()} disabled={isBusy}>
                Save
              </button>
              <button className="directory-action close" type="button" onClick={() => setSelectedBlockId(null)}>
                Close
              </button>
              <button className="directory-action icon danger" type="button" onClick={() => void resetBlock()} disabled={isBusy}>
                Reset
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
