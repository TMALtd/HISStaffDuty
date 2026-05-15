"use client";

import { toPng } from "html-to-image";
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
  "#d5b8ee",
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

export function TimetableBuilder({ initialData }: TimetableBuilderProps) {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState(initialData);
  const [classOptions, setClassOptions] = useState<TimetableClassSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialData.timetable?.template_id ?? initialData.templates[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableBlockDraft | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isDeletingTimetable, setIsDeletingTimetable] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);

  useEffect(() => {
    setData(initialData);
    setSelectedTemplateId(initialData.timetable?.template_id ?? initialData.templates[0]?.id ?? "");
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

  const rowSegments = useMemo(() => buildTimetableRowSegments(data.blocks), [data.blocks]);
  const rowLineByTime = useMemo(
    () => new Map(rowSegments.flatMap((segment, index) => [[segment.startTime, index + 1], [segment.endTime, index + 2]])),
    [rowSegments]
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

  const selectedBlock = selectedBlockId
    ? visibleBlocks.find((block) => block.id === selectedBlockId) ?? null
    : null;

  async function refreshBuilderData() {
    const response = await fetch(
      `/api/timetables/${encodeURIComponent(data.classSummary.className)}`,
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
      const response = await fetch(`/api/timetables/${encodeURIComponent(data.classSummary.className)}`, {
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
      const response = await fetch(`/api/timetables/${encodeURIComponent(data.classSummary.className)}`, {
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
          `/api/timetables/${encodeURIComponent(data.classSummary.className)}/blocks`,
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
          `/api/timetables/${encodeURIComponent(data.classSummary.className)}/blocks/${encodeURIComponent(targetBlockId)}`,
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

  async function exportAsPng() {
    if (!exportRef.current) {
      return;
    }

    setIsExportingImage(true);
    setStatus("");
    setError("");

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        backgroundColor: "#fffdf8",
        pixelRatio: 2
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${data.classSummary.className.replace(/\s+/g, "-").toLowerCase()}-timetable.png`;
      link.click();
      setStatus("Timetable PNG downloaded.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export PNG.");
    } finally {
      setIsExportingImage(false);
    }
  }

  function exportAsPdf() {
    setStatus("Print dialog opened. Choose Save as PDF to download.");
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
              value={data.classSummary.className}
              onChange={(event) => router.push(`/timetables/${encodeURIComponent(event.target.value)}`)}
            >
              <option value={data.classSummary.className}>{data.classSummary.className}</option>
              {classOptions
                .filter((entry) => entry.className !== data.classSummary.className)
                .map((entry) => (
                  <option key={entry.className} value={entry.className}>
                    {entry.className}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="builderTemplateSelect">Template</label>
            <select
              id="builderTemplateSelect"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              disabled={Boolean(data.timetable)}
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
            <div className="timetable-toolbar-value">
              {data.timetable ? `Live builder using ${data.timetable.template_name}` : "No timetable created yet"}
            </div>
          </div>
          {data.timetable ? (
            <div className="actions timetable-toolbar-actions">
              <button className="button secondary" type="button" onClick={() => exportAsPdf()}>
                Export PDF
              </button>
              <button className="button secondary" type="button" onClick={() => void exportAsPng()} disabled={isExportingImage}>
                {isExportingImage ? "Exporting..." : "Export PNG"}
              </button>
            </div>
          ) : null}
          {!data.timetable ? (
            <div className="actions timetable-toolbar-actions">
              <button className="button" type="button" onClick={() => void createTimetable()} disabled={isBusy}>
                {isBusy ? "Creating..." : "Create Timetable"}
              </button>
            </div>
          ) : null}
        </div>

        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Blocks</p>
          <p className="stat-value">{data.blocks.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Teachers linked</p>
          <p className="stat-value">
            {Array.from(new Set(data.blocks.flatMap((block) => block.teachers.map((teacher) => teacher.staff_id)))).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Template</p>
          <p className="stat-value smaller-stat">{data.timetable?.template_name ?? "None"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Days</p>
          <p className="stat-value">5</p>
        </div>
      </section>

      <section className="panel">
        {data.timetable ? (
          <div className="timetable-board-scroll">
            <div
              className={`timetable-export-surface${isExportingImage ? " is-export-clean" : ""}`}
              ref={exportRef}
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
                    const rowStart = (rowLineByTime.get(block.start_time) ?? 1) + 1;
                    const rowEnd = (rowLineByTime.get(block.end_time) ?? rowStart) + 1;

                    return (
                      <button
                        key={block.id}
                        className={`timetable-block-card timetable-grid-block ${blockDensityClass(block)}`.trim()}
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
                          {timeRangeLabel(block.start_time, block.end_time)}
                        </div>
                        <div className="timetable-block-meta muted-block-meta">
                          {BLOCK_TYPE_LABELS[block.block_type]}
                        </div>
                        {block.teachers.length ? (
                          <div className="timetable-teacher-strip">
                            {block.teachers.map((teacher) => (
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
