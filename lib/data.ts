import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import {
  type CreateTimetableClassInput,
  type ClassTimetable,
  type TimetableBlock,
  type TimetableBlockStaffAssignment,
  type TimetableBlockType,
  type TimetableBuilderData,
  type TimetableAdminOptions,
  type TimetableClassSummary,
  type TimetablePreviewStaffOption,
  type TimetablePeriod,
  type TimetableStaffOption,
  type TimetableStreamType,
  type TimetableSubjectTarget,
  type TimetableTemplate,
  type DutyDashboardData,
  type DutyRosterAssignment,
  type DutyRosterGroup,
  type DutyRosterRecord,
  type DutyRosterStaffOption,
  type DutyRosterSubGroup,
  type DutySummary,
  type DutyRosterViewData,
  EMPTY_FILTERS,
  FILTER_FIELDS,
  type GradebookEntry,
  type GradebookFieldDefinition,
  type GradebookSubject,
  type FilterField,
  type FilterOptions,
  type FilterState,
  type StaffDirectoryClassOption,
  type StaffDirectoryRecord,
  type StaffDirectoryUpsertInput,
  type StaffProfile,
  type StudentRow
} from "@/lib/types";

type ClassRecord = {
  School: string;
  Designation: string;
  "Year Group": string;
  Milepost: string;
  Level: string;
  "Class Code": string;
  "Class Name": string;
};

const TABLE_NAME = "Class List";
const VIEW_NAME = "student_class_roster";
const SUBJECTS_TABLE = "gradebook_subjects";
const FIELDS_TABLE = "gradebook_field_definitions";
const ENTRIES_TABLE = "gradebook_entries";
const STAFF_TABLE = "staff";
const DUTIES_TABLE = "duties";
const TIMETABLE_TEMPLATES_TABLE = "timetable_templates";
const TIMETABLE_PERIODS_TABLE = "timetable_periods";
const CLASS_TIMETABLES_TABLE = "class_timetables";
const TIMETABLE_BLOCKS_TABLE = "timetable_blocks";
const TIMETABLE_BLOCK_STAFF_TABLE = "timetable_block_staff";
const TIMETABLE_CLASSES_TABLE = "timetable_classes";
const TIMETABLE_SUBJECT_TARGETS_TABLE = "timetable_subject_targets";
const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const TIMETABLE_DEFAULT_COLORS: Record<TimetableBlockType, string> = {
  lesson: "#8be6a8",
  break: "#6b7280",
  lunch: "#6b7280",
  dismissal: "#9ca3af",
  assembly: "#f59e0b",
  other: "#c4b5fd"
};
const TIMETABLE_SETUP_MESSAGE =
  "Timetable database tables are not set up yet. Run supabase_timetable_setup.sql in Supabase before using the timetable builder.";
const TIMETABLE_STREAM_TYPES = ["mainstream", "bilingual"] as const;
const DEFAULT_TIMETABLE_SUBJECT_TARGETS: TimetableSubjectTarget[] = [
  { id: "default-mp1-mainstream-english", milepost: "Milepost 1", streamType: "mainstream", subjectName: "English", requiredMinutes: 160, sortOrder: 1, isActive: true },
  { id: "default-mp1-mainstream-maths", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Maths", requiredMinutes: 240, sortOrder: 2, isActive: true },
  { id: "default-mp1-mainstream-ipc", milepost: "Milepost 1", streamType: "mainstream", subjectName: "IPC", requiredMinutes: 240, sortOrder: 3, isActive: true },
  { id: "default-mp1-mainstream-guided-reading", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Guided Reading", requiredMinutes: 160, sortOrder: 4, isActive: true },
  { id: "default-mp1-mainstream-shared-reading", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Shared Reading", requiredMinutes: 160, sortOrder: 5, isActive: true },
  { id: "default-mp1-mainstream-phonics", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Phonics", requiredMinutes: 160, sortOrder: 6, isActive: true },
  { id: "default-mp1-mainstream-library", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Library", requiredMinutes: 40, sortOrder: 7, isActive: true },
  { id: "default-mp1-mainstream-coding", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Coding", requiredMinutes: 40, sortOrder: 8, isActive: true },
  { id: "default-mp1-mainstream-pe", milepost: "Milepost 1", streamType: "mainstream", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 9, isActive: true },
  { id: "default-mp1-mainstream-mandarin", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Mandarin", requiredMinutes: 120, sortOrder: 10, isActive: true },
  { id: "default-mp1-mainstream-bm", milepost: "Milepost 1", streamType: "mainstream", subjectName: "BM", requiredMinutes: 120, sortOrder: 11, isActive: true },
  { id: "default-mp1-mainstream-assembly", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp1-mainstream-financial-literacy", milepost: "Milepost 1", streamType: "mainstream", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp1-bilingual-english", milepost: "Milepost 1", streamType: "bilingual", subjectName: "English", requiredMinutes: 240, sortOrder: 1, isActive: true },
  { id: "default-mp1-bilingual-maths", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Maths", requiredMinutes: 240, sortOrder: 2, isActive: true },
  { id: "default-mp1-bilingual-ipc", milepost: "Milepost 1", streamType: "bilingual", subjectName: "IPC", requiredMinutes: 240, sortOrder: 3, isActive: true },
  { id: "default-mp1-bilingual-guided-reading", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Guided Reading", requiredMinutes: 160, sortOrder: 4, isActive: true },
  { id: "default-mp1-bilingual-shared-reading", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Shared Reading", requiredMinutes: 160, sortOrder: 5, isActive: true },
  { id: "default-mp1-bilingual-phonics", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Phonics", requiredMinutes: 160, sortOrder: 6, isActive: true },
  { id: "default-mp1-bilingual-library", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Library", requiredMinutes: 40, sortOrder: 7, isActive: true },
  { id: "default-mp1-bilingual-coding", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Coding", requiredMinutes: 40, sortOrder: 8, isActive: true },
  { id: "default-mp1-bilingual-pe", milepost: "Milepost 1", streamType: "bilingual", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 9, isActive: true },
  { id: "default-mp1-bilingual-mandarin", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Mandarin", requiredMinutes: 240, sortOrder: 10, isActive: true },
  { id: "default-mp1-bilingual-bm", milepost: "Milepost 1", streamType: "bilingual", subjectName: "BM", requiredMinutes: 120, sortOrder: 11, isActive: true },
  { id: "default-mp1-bilingual-assembly", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp1-bilingual-financial-literacy", milepost: "Milepost 1", streamType: "bilingual", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp2-mainstream-english", milepost: "Milepost 2", streamType: "mainstream", subjectName: "English", requiredMinutes: 280, sortOrder: 1, isActive: true },
  { id: "default-mp2-mainstream-maths", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Maths", requiredMinutes: 300, sortOrder: 2, isActive: true },
  { id: "default-mp2-mainstream-ipc", milepost: "Milepost 2", streamType: "mainstream", subjectName: "IPC", requiredMinutes: 240, sortOrder: 3, isActive: true },
  { id: "default-mp2-mainstream-guided-reading", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Guided Reading", requiredMinutes: 200, sortOrder: 4, isActive: true },
  { id: "default-mp2-mainstream-shared-reading", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Shared Reading", requiredMinutes: 100, sortOrder: 5, isActive: true },
  { id: "default-mp2-mainstream-library", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Library", requiredMinutes: 40, sortOrder: 6, isActive: true },
  { id: "default-mp2-mainstream-coding", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Coding", requiredMinutes: 40, sortOrder: 7, isActive: true },
  { id: "default-mp2-mainstream-pe", milepost: "Milepost 2", streamType: "mainstream", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 8, isActive: true },
  { id: "default-mp2-mainstream-mandarin", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Mandarin", requiredMinutes: 120, sortOrder: 9, isActive: true },
  { id: "default-mp2-mainstream-bm", milepost: "Milepost 2", streamType: "mainstream", subjectName: "BM", requiredMinutes: 120, sortOrder: 10, isActive: true },
  { id: "default-mp2-mainstream-assembly", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 11, isActive: true },
  { id: "default-mp2-mainstream-financial-literacy", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp2-mainstream-pshe", milepost: "Milepost 2", streamType: "mainstream", subjectName: "PSHE", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp2-mainstream-music", milepost: "Milepost 2", streamType: "mainstream", subjectName: "Music", requiredMinutes: 40, sortOrder: 14, isActive: true },
  { id: "default-mp2-bilingual-english", milepost: "Milepost 2", streamType: "bilingual", subjectName: "English", requiredMinutes: 280, sortOrder: 1, isActive: true },
  { id: "default-mp2-bilingual-maths", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Maths", requiredMinutes: 280, sortOrder: 2, isActive: true },
  { id: "default-mp2-bilingual-ipc", milepost: "Milepost 2", streamType: "bilingual", subjectName: "IPC", requiredMinutes: 240, sortOrder: 3, isActive: true },
  { id: "default-mp2-bilingual-guided-reading", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Guided Reading", requiredMinutes: 160, sortOrder: 4, isActive: true },
  { id: "default-mp2-bilingual-library", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Library", requiredMinutes: 40, sortOrder: 5, isActive: true },
  { id: "default-mp2-bilingual-coding", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Coding", requiredMinutes: 40, sortOrder: 6, isActive: true },
  { id: "default-mp2-bilingual-pe", milepost: "Milepost 2", streamType: "bilingual", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 7, isActive: true },
  { id: "default-mp2-bilingual-mandarin", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Mandarin", requiredMinutes: 320, sortOrder: 8, isActive: true },
  { id: "default-mp2-bilingual-bm", milepost: "Milepost 2", streamType: "bilingual", subjectName: "BM", requiredMinutes: 120, sortOrder: 9, isActive: true },
  { id: "default-mp2-bilingual-assembly", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 10, isActive: true },
  { id: "default-mp2-bilingual-financial-literacy", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 11, isActive: true },
  { id: "default-mp2-bilingual-pshe", milepost: "Milepost 2", streamType: "bilingual", subjectName: "PSHE", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp2-bilingual-music", milepost: "Milepost 2", streamType: "bilingual", subjectName: "Music", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp3-mainstream-english", milepost: "Milepost 3", streamType: "mainstream", subjectName: "English", requiredMinutes: 320, sortOrder: 1, isActive: true },
  { id: "default-mp3-mainstream-maths", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Maths", requiredMinutes: 320, sortOrder: 2, isActive: true },
  { id: "default-mp3-mainstream-ipc", milepost: "Milepost 3", streamType: "mainstream", subjectName: "IPC", requiredMinutes: 160, sortOrder: 3, isActive: true },
  { id: "default-mp3-mainstream-guided-reading", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Guided Reading", requiredMinutes: 200, sortOrder: 4, isActive: true },
  { id: "default-mp3-mainstream-science", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Science", requiredMinutes: 80, sortOrder: 5, isActive: true },
  { id: "default-mp3-mainstream-dt", milepost: "Milepost 3", streamType: "mainstream", subjectName: "DT", requiredMinutes: 40, sortOrder: 6, isActive: true },
  { id: "default-mp3-mainstream-library", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Library", requiredMinutes: 40, sortOrder: 7, isActive: true },
  { id: "default-mp3-mainstream-coding", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Coding", requiredMinutes: 40, sortOrder: 8, isActive: true },
  { id: "default-mp3-mainstream-pe", milepost: "Milepost 3", streamType: "mainstream", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 9, isActive: true },
  { id: "default-mp3-mainstream-mandarin", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Mandarin", requiredMinutes: 120, sortOrder: 10, isActive: true },
  { id: "default-mp3-mainstream-bm", milepost: "Milepost 3", streamType: "mainstream", subjectName: "BM", requiredMinutes: 120, sortOrder: 11, isActive: true },
  { id: "default-mp3-mainstream-assembly", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp3-mainstream-financial-literacy", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp3-mainstream-pshe", milepost: "Milepost 3", streamType: "mainstream", subjectName: "PSHE", requiredMinutes: 40, sortOrder: 14, isActive: true },
  { id: "default-mp3-mainstream-music", milepost: "Milepost 3", streamType: "mainstream", subjectName: "Music", requiredMinutes: 40, sortOrder: 15, isActive: true },
  { id: "default-mp3-bilingual-english", milepost: "Milepost 3", streamType: "bilingual", subjectName: "English", requiredMinutes: 280, sortOrder: 1, isActive: true },
  { id: "default-mp3-bilingual-maths", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Maths", requiredMinutes: 280, sortOrder: 2, isActive: true },
  { id: "default-mp3-bilingual-ipc", milepost: "Milepost 3", streamType: "bilingual", subjectName: "IPC", requiredMinutes: 160, sortOrder: 3, isActive: true },
  { id: "default-mp3-bilingual-guided-reading", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Guided Reading", requiredMinutes: 120, sortOrder: 4, isActive: true },
  { id: "default-mp3-bilingual-science", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Science", requiredMinutes: 80, sortOrder: 5, isActive: true },
  { id: "default-mp3-bilingual-library", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Library", requiredMinutes: 40, sortOrder: 6, isActive: true },
  { id: "default-mp3-bilingual-coding", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Coding", requiredMinutes: 40, sortOrder: 7, isActive: true },
  { id: "default-mp3-bilingual-pe", milepost: "Milepost 3", streamType: "bilingual", subjectName: "P.E.", requiredMinutes: 120, sortOrder: 8, isActive: true },
  { id: "default-mp3-bilingual-mandarin", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Mandarin", requiredMinutes: 320, sortOrder: 9, isActive: true },
  { id: "default-mp3-bilingual-bm", milepost: "Milepost 3", streamType: "bilingual", subjectName: "BM", requiredMinutes: 120, sortOrder: 10, isActive: true },
  { id: "default-mp3-bilingual-assembly", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Assembly", requiredMinutes: 40, sortOrder: 11, isActive: true },
  { id: "default-mp3-bilingual-financial-literacy", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Financial Literacy", requiredMinutes: 40, sortOrder: 12, isActive: true },
  { id: "default-mp3-bilingual-pshe", milepost: "Milepost 3", streamType: "bilingual", subjectName: "PSHE", requiredMinutes: 40, sortOrder: 13, isActive: true },
  { id: "default-mp3-bilingual-music", milepost: "Milepost 3", streamType: "bilingual", subjectName: "Music", requiredMinutes: 40, sortOrder: 14, isActive: true }
];
const SPECIALIST_SUBJECT_COLORS: Record<string, string> = {
  BM: "#d95c02",
  Mandarin: "#f4a7ff",
  "P.E.": "#1d4ed8",
  Library: "#6b7280",
  Music: "#efbadf",
  Coding: "#76ddd1",
  Assembly: "#f59e0b"
};
const TIMETABLE_SUBJECT_COLORS: Record<string, string> = {
  "Pastoral Time": "#111827",
  English: "#8be6a8",
  Maths: "#d5b8ee",
  IPC: "#a8c7f0",
  Mandarin: "#f4a7ff",
  BM: "#d95c02",
  "P.E.": "#1d4ed8",
  Coding: "#ffffff",
  Library: "#ffd090",
  Music: "#efbadf",
  "Guided Reading": "#76ddd1",
  "Shared Reading": "#ffe97c",
  Phonics: "#ffe97c",
  Assembly: "#f79ca1",
  "Financial Literacy": "#f79ca1",
  PSHE: "#7c3aed",
  CCA: "#c4b5fd"
};

function normalizeTimetableLookupKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildTimetableLookupKeys(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const normalized = normalizeTimetableLookupKey(trimmed);
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const keys = new Set<string>();

  if (normalized) {
    keys.add(normalized);
  }

  if (compact) {
    keys.add(compact);
  }

  const numberedClassMatch = trimmed.match(/^(preschool\s*\d+|\d+)\s+(.+)$/i);
  if (numberedClassMatch) {
    const shortLabel = numberedClassMatch[2].trim();
    const shortNormalized = normalizeTimetableLookupKey(shortLabel);
    const shortCompact = shortLabel.toLowerCase().replace(/[^a-z0-9]+/g, "");

    if (shortNormalized) {
      keys.add(shortNormalized);
    }

    if (shortCompact) {
      keys.add(shortCompact);
    }
  }

  return Array.from(keys);
}
const TIMETABLE_YEAR_GROUP_ORDER = [
  "Preschool 1",
  "Preschool 2",
  "Preschool",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Year 13"
] as const;

function normalizeFilterState(filters: Partial<FilterState>): FilterState {
  return {
    school: filters.school ?? EMPTY_FILTERS.school,
    designation: filters.designation ?? EMPTY_FILTERS.designation,
    yearGroup: filters.yearGroup ?? EMPTY_FILTERS.yearGroup,
    milepost: filters.milepost ?? EMPTY_FILTERS.milepost,
    level: filters.level ?? EMPTY_FILTERS.level,
    className: filters.className ?? EMPTY_FILTERS.className
  };
}

function matchesPrefix(row: ClassRecord, filters: FilterState, upToIndex: number) {
  const prefixFields = FILTER_FIELDS.slice(0, upToIndex);

  for (const field of prefixFields) {
    const selected = filters[field];
    if (!selected) {
      continue;
    }

    if (getClassValue(row, field) !== selected) {
      return false;
    }
  }

  return true;
}

function getClassValue(row: ClassRecord, field: FilterField) {
  switch (field) {
    case "school":
      return row.School;
    case "designation":
      return row.Designation;
    case "yearGroup":
      return row["Year Group"];
    case "milepost":
      return row.Milepost;
    case "level":
      return row.Level;
    case "className":
      return row["Class Name"];
  }
}

function formatDutyLocation(first?: string | null, second?: string | null) {
  return [first, second].filter(Boolean).join(" / ");
}

function formatDaysSummary(value?: string | null) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
        .join(", ");
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function formatDayLabel(value?: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(", ");
    } catch {
      // Fall through to the plain-text normalizer below.
    }
  }

  return trimmed
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z]/gi, ""))
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(", ");
}

function weekdayInfo() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long"
  });
  const weekdayLabel = formatter.format(new Date());
  return {
    weekdayLabel,
    weekdayKey: weekdayLabel.toLowerCase()
  };
}

function weekdaySortValue(weekday: string) {
  const normalized = weekday.trim().toLowerCase();
  const index = WEEKDAY_ORDER.indexOf(normalized as (typeof WEEKDAY_ORDER)[number]);
  return index === -1 ? 99 : index;
}

function normalizeTimetableBlockType(value: unknown): TimetableBlockType {
  const normalized = String(value ?? "lesson").trim().toLowerCase();
  if (
    normalized === "lesson" ||
    normalized === "break" ||
    normalized === "lunch" ||
    normalized === "dismissal" ||
    normalized === "assembly" ||
    normalized === "other"
  ) {
    return normalized;
  }

  return "lesson";
}

function normalizeTimetableTemplate(row: Record<string, unknown>): TimetableTemplate {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Template"),
    school: row.school ? String(row.school) : null,
    designation: row.designation ? String(row.designation) : null,
    year_group: row.year_group ? String(row.year_group) : null,
    is_active: Boolean(row.is_active ?? true)
  };
}

function normalizeTimetablePeriod(row: Record<string, unknown>): TimetablePeriod {
  return {
    id: String(row.id ?? ""),
    template_id: String(row.template_id ?? ""),
    weekday: String(row.weekday ?? "").toLowerCase(),
    label: String(row.label ?? ""),
    start_time: String(row.start_time ?? ""),
    end_time: String(row.end_time ?? ""),
    block_type: normalizeTimetableBlockType(row.block_type),
    sort_order:
      typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0)
  };
}

function normalizeTimetableStreamType(value: unknown): TimetableStreamType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if ((TIMETABLE_STREAM_TYPES as readonly string[]).includes(normalized)) {
    return normalized as TimetableStreamType;
  }

  return null;
}

function titleCaseWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCustomClassRow(row: Record<string, unknown>): ClassRecord {
  return {
    School: String(row.school ?? "Primary"),
    Designation: titleCaseWords(String(row.designation ?? row.stream_type ?? "Mainstream")),
    "Year Group": String(row.year_group ?? ""),
    Milepost: String(row.milepost ?? ""),
    Level: String(row.level ?? "Primary"),
    "Class Code": String(row.class_code ?? ""),
    "Class Name": String(row.class_name ?? "")
  };
}

function normalizeTimetableSubjectTarget(row: Record<string, unknown>): TimetableSubjectTarget {
  return {
    id: String(row.id ?? ""),
    milepost: String(row.milepost ?? ""),
    streamType: normalizeTimetableStreamType(row.stream_type) ?? "mainstream",
    subjectName: String(row.subject_name ?? ""),
    requiredMinutes: Number(row.required_minutes ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true)
  };
}

function normalizeClassTimetable(
  row: Record<string, unknown>,
  templateLookup: Map<string, TimetableTemplate>
): ClassTimetable {
  const templateId = String(row.template_id ?? "");
  return {
    id: String(row.id ?? ""),
    class_code: row.class_code ? String(row.class_code) : null,
    class_name: String(row.class_name ?? ""),
    template_id: templateId,
    template_name: templateLookup.get(templateId)?.name ?? "Template",
    stream_type: normalizeTimetableStreamType(row.stream_type),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}

function defaultColorForTimetableType(blockType: TimetableBlockType) {
  return TIMETABLE_DEFAULT_COLORS[blockType] ?? TIMETABLE_DEFAULT_COLORS.lesson;
}

function defaultTitleForTimetableType(params: {
  blockType: TimetableBlockType;
  periodLabel: string;
}) {
  return params.blockType === "lesson" ? null : params.periodLabel;
}

function isMissingSupabaseRelationError(error: unknown, tableName: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes(tableName.toLowerCase()) &&
    !normalized.includes("column") &&
    !normalized.includes("pgrst204") &&
    (normalized.includes("does not exist") ||
      normalized.includes("could not find the table") ||
      normalized.includes("pgrst205"))
  );
}

function isMissingSupabaseColumnError(error: unknown, tableName: string, columnName: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes(tableName.toLowerCase()) &&
    normalized.includes(columnName.toLowerCase()) &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the") ||
      normalized.includes("pgrst204"))
  );
}

function timetableYearGroupOrderValue(yearGroup: string) {
  const trimmed = yearGroup.trim();
  const explicitIndex = TIMETABLE_YEAR_GROUP_ORDER.findIndex(
    (value) => value.toLowerCase() === trimmed.toLowerCase()
  );

  if (explicitIndex !== -1) {
    return explicitIndex;
  }

  const match = trimmed.match(/year\s*(\d+)/i);
  if (match) {
    return TIMETABLE_YEAR_GROUP_ORDER.length + Number(match[1]);
  }

  return TIMETABLE_YEAR_GROUP_ORDER.length + 999;
}

function timetableClassNameSortValue(className: string) {
  const trimmed = className.trim();

  if (/^preschool\s*1\b/i.test(trimmed)) {
    return { family: 0, number: 1, label: trimmed };
  }

  if (/^preschool\s*2\b/i.test(trimmed)) {
    return { family: 0, number: 2, label: trimmed };
  }

  const numberedMatch = trimmed.match(/^(\d+)\s+(.+)$/);
  if (numberedMatch) {
    return {
      family: 1,
      number: Number(numberedMatch[1]),
      label: numberedMatch[2]
    };
  }

  return {
    family: 2,
    number: 999,
    label: trimmed
  };
}

function compareTimetableClassSummaries(left: TimetableClassSummary, right: TimetableClassSummary) {
  const yearOrderDelta =
    timetableYearGroupOrderValue(left.yearGroup) - timetableYearGroupOrderValue(right.yearGroup);
  if (yearOrderDelta !== 0) {
    return yearOrderDelta;
  }

  const leftClassSort = timetableClassNameSortValue(left.className);
  const rightClassSort = timetableClassNameSortValue(right.className);

  if (leftClassSort.family !== rightClassSort.family) {
    return leftClassSort.family - rightClassSort.family;
  }

  if (leftClassSort.number !== rightClassSort.number) {
    return leftClassSort.number - rightClassSort.number;
  }

  const labelDelta = leftClassSort.label.localeCompare(rightClassSort.label, undefined, {
    numeric: true
  });
  if (labelDelta !== 0) {
    return labelDelta;
  }

  const schoolDelta = left.school.localeCompare(right.school, undefined, { numeric: true });
  if (schoolDelta !== 0) {
    return schoolDelta;
  }

  return left.designation.localeCompare(right.designation, undefined, { numeric: true });
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCsvTimeValue(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour >= 1 && hour <= 6) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function normalizeCsvTimeRange(value: string) {
  const match = value.trim().match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) {
    return null;
  }

  const startTime = normalizeCsvTimeValue(match[1]);
  const endTime = normalizeCsvTimeValue(match[2]);

  if (!startTime || !endTime) {
    return null;
  }

  return { startTime, endTime };
}

function normalizeSpecialistSubjectLabel(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const upper = trimmed.toUpperCase().replace(/\./g, "");

  if (upper === "BM" || upper === "BAHASA MELAYU") {
    return "BM";
  }
  if (upper === "MANDARIN") {
    return "Mandarin";
  }
  if (upper === "PE" || upper === "P E") {
    return "P.E.";
  }
  if (upper === "LIBRARY") {
    return "Library";
  }
  if (upper === "MUSIC") {
    return "Music";
  }
  if (upper === "CODING") {
    return "Coding";
  }
  if (upper === "ASSEMBLY") {
    return "Assembly";
  }

  return trimmed;
}

function specialistSubjectColor(subject: string) {
  return SPECIALIST_SUBJECT_COLORS[subject] ?? "#8be6a8";
}

function timetableSubjectColor(title: string | null) {
  const normalizedTitle = normalizeSpecialistSubjectLabel(title ?? "");

  if (normalizedTitle.includes("/")) {
    const segments = normalizedTitle
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const matchedSegment = segments.find((segment) => TIMETABLE_SUBJECT_COLORS[segment]);
    if (matchedSegment) {
      return TIMETABLE_SUBJECT_COLORS[matchedSegment];
    }
  }

  if (TIMETABLE_SUBJECT_COLORS[normalizedTitle]) {
    return TIMETABLE_SUBJECT_COLORS[normalizedTitle];
  }

  return null;
}

function resolveTimetableColor(title: string | null, color: string | null, blockType?: TimetableBlockType) {
  const subjectColor = timetableSubjectColor(title);

  if (subjectColor) {
    return subjectColor;
  }

  if (color?.trim()) {
    return color.trim();
  }

  return blockType ? defaultColorForTimetableType(blockType) : color;
}

function normalizeTimeKey(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return trimmed;
  }

  return `${match[1]}:${match[2]}:00`;
}

function csvEscape(value: string | null | undefined) {
  const normalized = value ?? "";
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function csvWeekdayLabel(weekday: string) {
  return weekday ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1).toLowerCase()}` : "";
}

function csvTimeLabel(value: string) {
  const normalized = normalizeTimeKey(value);
  return normalized.slice(0, 5);
}

function classCsvFilename(className: string) {
  return `${className.replace(/\s+/g, "-").toLowerCase()}-timetable-template.csv`;
}

function normalizeClassCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function splitTeacherCsvValue(value: string) {
  return value
    .split(/[|;,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeStaffProfile(row: Record<string, unknown>): StaffProfile {
  return {
    id: String(row.id ?? ""),
    staff_id: row.staff_id ? String(row.staff_id) : null,
    name: String(row.name ?? ""),
    first_name: row.first_name ? String(row.first_name) : null,
    role: row.role ? String(row.role) : null,
    email: row.email ? String(row.email) : null,
    department: row.department ? String(row.department) : null,
    class: row.class ? String(row.class) : null,
    extension: row.extension ? String(row.extension) : null,
    max_duties:
      typeof row.max_duties === "number"
        ? row.max_duties
        : row.max_duties
          ? Number(row.max_duties)
          : null,
    status: row.status ? String(row.status) : null,
    unavailable_reason: row.unavailable_reason ? String(row.unavailable_reason) : null,
    timetable: row.timetable ? String(row.timetable) : null,
    photo_url: row.photo_url ? String(row.photo_url) : null,
    designation: row.designation ? String(row.designation) : null,
    system_role: row.system_role ? String(row.system_role) : null
  };
}

function normalizeDutyRow(row: Record<string, unknown>): DutySummary {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? row.duty_name ?? "Duty"),
    location: formatDutyLocation(
      row.first_location ? String(row.first_location) : null,
      row.second_location ? String(row.second_location) : null
    ),
    dayLabel: formatDayLabel(
      row.day_of_week ? String(row.day_of_week) : row.days_of_week ? String(row.days_of_week) : null
    ),
    timeLabel:
      row.start_time && row.end_time
        ? `${String(row.start_time)} - ${String(row.end_time)}`
        : row.start_time
          ? String(row.start_time)
          : "Time TBC",
    category: row.category ? String(row.category) : null,
    color: row.color ? String(row.color) : null,
    assignedStaffId: row.assigned_staff_id ? String(row.assigned_staff_id) : null
  };
}

async function getActiveDutyRows() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(DUTIES_TABLE)
    .select(
      "id,name,duty_name,description,first_location,second_location,start_time,end_time,days_of_week,day_of_week,assigned_staff_id,is_active,color,category,parent_duty_id,is_day_instance,sort_order,day_order,duty_order,daily_order_number,unique_duty_id"
    )
    .eq("is_active", true)
    .order("start_time");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeDutyRow);
}

export async function getClassRecords() {
  const supabase = createSupabaseAdminClient();
  const [{ data, error }, customClassRecords] = await Promise.all([
    supabase.from(TABLE_NAME).select("*"),
    getCustomTimetableClassRecords()
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const merged = new Map<string, ClassRecord>();

  ((data ?? []) as ClassRecord[]).forEach((row) => {
    merged.set(normalizeTimetableLookupKey(row["Class Code"] || row["Class Name"]), row);
  });

  customClassRecords.forEach((row) => {
    merged.set(normalizeTimetableLookupKey(row["Class Code"] || row["Class Name"]), row);
  });

  return Array.from(merged.values()).sort((left, right) =>
    [
      left.School,
      left.Designation,
      left["Year Group"],
      left.Milepost,
      left.Level,
      left["Class Name"]
    ]
      .join("|")
      .localeCompare(
        [
          right.School,
          right.Designation,
          right["Year Group"],
          right.Milepost,
          right.Level,
          right["Class Name"]
        ].join("|"),
        undefined,
        { numeric: true }
      )
  );
}

async function getCustomTimetableClassRecords(): Promise<ClassRecord[]> {
  const supabase = createSupabaseAdminClient();
  const attempts: Array<{
    select: string;
    defaults?: Record<string, unknown>;
  }> = [
    {
      select: "class_code,class_name,school,designation,year_group,milepost,level,stream_type"
    },
    {
      select: "class_code,class_name,school,designation,year_group,milepost,level",
      defaults: { stream_type: null }
    }
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const result = await supabase.from(TIMETABLE_CLASSES_TABLE).select(attempt.select);

    if (result.error) {
      if (isMissingSupabaseRelationError(new Error(result.error.message), TIMETABLE_CLASSES_TABLE)) {
        return [];
      }

      lastError = new Error(result.error.message);
      continue;
    }

      return ((result.data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
        normalizeCustomClassRow({
          ...attempt.defaults,
          ...row
        })
      );
  }

  throw lastError ?? new Error("Unable to load timetable classes.");
}

function inferMilepostFromYearGroup(yearGroup: string) {
  switch (yearGroup.trim().toLowerCase()) {
    case "year 1":
    case "year 2":
      return "Milepost 1";
    case "year 3":
    case "year 4":
      return "Milepost 2";
    case "year 5":
    case "year 6":
      return "Milepost 3";
    case "preschool":
      return "Preschool";
    default:
      return yearGroup;
  }
}

function buildSuggestedClassCode(className: string, yearGroup: string) {
  const tokens = className
    .trim()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  const yearMatch = yearGroup.match(/(\d+)/);
  const classYear = tokens[0]?.match(/^\d+$/)?.[0] ?? yearMatch?.[1] ?? "C";
  const nameToken =
    tokens.find((token, index) => index > 0 && !/^\d+$/.test(token)) ??
    tokens.find((token) => !/^\d+$/.test(token)) ??
    "Class";

  return `${classYear}${nameToken.slice(0, 2)}`.replace(/[^a-z0-9]/gi, "");
}

export async function createTimetableClass(input: CreateTimetableClassInput): Promise<ClassRecord> {
  const className = input.className.trim();
  const yearGroup = input.yearGroup.trim();
  const school = input.school.trim() || "Primary";
  const level = input.level.trim() || "Primary";
  const streamType = normalizeTimetableStreamType(input.streamType) ?? "mainstream";
  const designation = titleCaseWords(input.designation || streamType);
  const milepost = input.milepost.trim() || inferMilepostFromYearGroup(yearGroup);
  const classCode = (input.classCode.trim() || buildSuggestedClassCode(className, yearGroup)).replace(/\s+/g, "");

  if (!className || !yearGroup || !classCode) {
    throw new Error("Class name, year group, and class code are required.");
  }

  const existingClasses = await getClassRecords();
  const duplicate = existingClasses.find(
    (row) =>
      normalizeTimetableLookupKey(row["Class Code"]) === normalizeTimetableLookupKey(classCode) ||
      normalizeTimetableLookupKey(row["Class Name"]) === normalizeTimetableLookupKey(className)
  );

  if (duplicate) {
    throw new Error(`${className} already exists in the timetable class list.`);
  }

  const supabase = createSupabaseAdminClient();
  const payload = {
    class_code: classCode,
    class_name: className,
    school,
    designation,
    year_group: yearGroup,
    milepost,
    level,
    stream_type: streamType
  };

  const attempts: Array<{
    payload: Record<string, unknown>;
  }> = [
    { payload },
    {
      payload: {
        class_code: classCode,
        class_name: className,
        school,
        designation,
        year_group: yearGroup,
        milepost,
        level
      }
    }
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const result = await supabase.from(TIMETABLE_CLASSES_TABLE).insert(attempt.payload).select("*").single();

    if (result.error) {
      lastError = new Error(result.error.message);
      continue;
    }

    return normalizeCustomClassRow(result.data as Record<string, unknown>);
  }

  throw lastError ?? new Error("Could not create timetable class.");
}

function findClassRecordByCode(classRecords: ClassRecord[], classCode: string) {
  const normalizedCode = classCode.trim().toLowerCase();
  return classRecords.find((row) => row["Class Code"].trim().toLowerCase() === normalizedCode) ?? null;
}

function findClassRecordByName(classRecords: ClassRecord[], className: string) {
  const normalizedName = className.trim().toLowerCase();
  return classRecords.find((row) => row["Class Name"].trim().toLowerCase() === normalizedName) ?? null;
}

export async function getFilterOptions(filters: Partial<FilterState>): Promise<FilterOptions> {
  const normalized = normalizeFilterState(filters);
  const rows = await getClassRecords();

  const result = {} as FilterOptions;

  FILTER_FIELDS.forEach((field, index) => {
    const candidates = rows.filter((row) => matchesPrefix(row, normalized, index));
    const options = Array.from(new Set(candidates.map((row) => getClassValue(row, field)))).sort(
      (left, right) => left.localeCompare(right, undefined, { numeric: true })
    );

    result[field] = options;
  });

  return result;
}

export async function getStudents(filters: Partial<FilterState>): Promise<StudentRow[]> {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeFilterState(filters);

  let query = supabase
    .from(VIEW_NAME)
    .select(
      "class_code,class_name,school,designation,year_group,milepost,level,school_id,full_name,surname,first_name,preferred_name,gender,form,year_code,tutor,academic_house"
    )
    .order("class_name")
    .order("full_name");

  if (normalized.school) {
    query = query.eq("school", normalized.school);
  }
  if (normalized.designation) {
    query = query.eq("designation", normalized.designation);
  }
  if (normalized.yearGroup) {
    query = query.eq("year_group", normalized.yearGroup);
  }
  if (normalized.milepost) {
    query = query.eq("milepost", normalized.milepost);
  }
  if (normalized.level) {
    query = query.eq("level", normalized.level);
  }
  if (normalized.className) {
    query = query.eq("class_name", normalized.className);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as StudentRow[]).map((student) => ({
    ...student,
    school_id: String(student.school_id),
    full_name: student.full_name ?? "",
    surname: student.surname ?? null,
    first_name: student.first_name ?? null,
    preferred_name: student.preferred_name ?? null,
    gender: student.gender ?? null,
    form: student.form ?? "",
    year_code: student.year_code ?? null,
    tutor: student.tutor ?? null,
    academic_house: student.academic_house ?? null
  }));
}

export async function getStaffProfileByEmail(email: string): Promise<StaffProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select(
      "id,staff_id,name,first_name,role,email,department,class,extension,max_duties,status,unavailable_reason,timetable,photo_url,designation,system_role"
    )
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeStaffProfile(data as Record<string, unknown>) : null;
}

export async function getTimetablePreviewStaffOptions(): Promise<TimetablePreviewStaffOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("name,email")
    .not("email", "is", null)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const seenEmails = new Set<string>();

  return ((data ?? []) as Array<{ name?: string | null; email?: string | null }>)
    .map((row) => ({
      email: String(row.email ?? "").trim().toLowerCase(),
      name: String(row.name ?? "").trim()
    }))
    .filter((row) => row.email && row.name)
    .filter((row) => {
      if (seenEmails.has(row.email)) {
        return false;
      }

      seenEmails.add(row.email);
      return true;
    });
}

export async function getDutyDashboardData(email: string): Promise<DutyDashboardData> {
  const staffProfile = await getStaffProfileByEmail(email);
  const { weekdayKey, weekdayLabel } = weekdayInfo();
  const duties = await getActiveDutyRows();
  const todaysSnapshot = duties.filter((duty) => duty.dayLabel.toLowerCase().includes(weekdayKey));
  const myUpcomingDuties = staffProfile
    ? duties.filter((duty) => duty.assignedStaffId === staffProfile.id)
    : [];
  const unassignedCount = todaysSnapshot.filter((duty) => !duty.assignedStaffId).length;

  return {
    staffProfile,
    myUpcomingDuties,
    todaysSnapshot,
    unassignedCount,
    activeDutyCount: duties.length,
    weekdayLabel
  };
}

export async function getStaffDirectoryData(): Promise<StaffDirectoryRecord[]> {
  const supabase = createSupabaseAdminClient();

  const [{ data: staffData, error: staffError }, { data: dutyData, error: dutyError }] =
    await Promise.all([
      supabase
        .from(STAFF_TABLE)
        .select(
          "id,staff_id,name,first_name,role,email,department,class,extension,max_duties,status,unavailable_reason,timetable,photo_url,designation,system_role"
        )
        .order("name"),
      supabase
        .from(DUTIES_TABLE)
        .select(
          "id,name,duty_name,first_location,second_location,start_time,end_time,days_of_week,day_of_week,assigned_staff_id,is_active,color,category"
        )
        .eq("is_active", true)
        .order("start_time")
    ]);

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (dutyError) {
    throw new Error(dutyError.message);
  }

  const duties = ((dutyData ?? []) as Record<string, unknown>[]).map(normalizeDutyRow);
  const dutiesByStaffId = new Map<string, DutySummary[]>();

  duties.forEach((duty) => {
    if (!duty.assignedStaffId) {
      return;
    }

    const current = dutiesByStaffId.get(duty.assignedStaffId) ?? [];
    current.push(duty);
    dutiesByStaffId.set(duty.assignedStaffId, current);
  });

  return ((staffData ?? []) as Record<string, unknown>[])
    .map((row) => {
      const profile = normalizeStaffProfile(row);
      return {
        ...profile,
        assigned_duties: dutiesByStaffId.get(profile.id) ?? []
      };
    })
    .sort((left, right) => {
      const leftOrder = Number(left.staff_id);
      const rightOrder = Number(right.staff_id);
      const leftIsNumeric = Number.isFinite(leftOrder);
      const rightIsNumeric = Number.isFinite(rightOrder);

      if (leftIsNumeric && rightIsNumeric) {
        return leftOrder - rightOrder;
      }

      if (leftIsNumeric) {
        return -1;
      }

      if (rightIsNumeric) {
        return 1;
      }

      return (left.staff_id ?? left.name).localeCompare(right.staff_id ?? right.name, undefined, {
        numeric: true
      });
    });
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredText(value: string | null | undefined, fieldLabel: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return trimmed;
}

function normalizeOptionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStaffDirectoryPayload(input: StaffDirectoryUpsertInput) {
  return {
    staff_id: normalizeOptionalText(input.staff_id),
    name: normalizeRequiredText(input.name, "Staff name"),
    first_name: normalizeOptionalText(input.first_name),
    role: normalizeOptionalText(input.role),
    email: normalizeOptionalText(input.email)?.toLowerCase() ?? null,
    department: normalizeOptionalText(input.department),
    class: normalizeOptionalText(input.class),
    extension: normalizeOptionalText(input.extension),
    max_duties: normalizeOptionalNumber(input.max_duties),
    status: normalizeOptionalText(input.status),
    unavailable_reason: normalizeOptionalText(input.unavailable_reason),
    timetable: normalizeOptionalText(input.timetable),
    photo_url: normalizeOptionalText(input.photo_url),
    designation: normalizeOptionalText(input.designation),
    system_role: normalizeOptionalText(input.system_role)
  };
}

async function getNextStaffDirectoryStaffId(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase.from(STAFF_TABLE).select("staff_id");

  if (error) {
    throw new Error(error.message);
  }

  const highestStaffId = (data ?? []).reduce((highest, row) => {
    const parsed = Number(String(row?.staff_id ?? "").trim());
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0);

  return String(highestStaffId + 1);
}

export async function getStaffDirectoryClassOptions(): Promise<StaffDirectoryClassOption[]> {
  const [classRecords, timetableRows] = await Promise.all([
    getClassRecords(),
    selectClassTimetableRows()
  ]);
  const uniqueOptions = new Map<string, StaffDirectoryClassOption>();

  classRecords.forEach((row) => {
    const classCode = String(row["Class Code"] ?? "").trim();
    const className = String(row["Class Name"] ?? "").trim();

    if (!classCode && !className) {
      return;
    }

    const option: StaffDirectoryClassOption = {
      classCode,
      className,
      yearGroup: String(row["Year Group"] ?? "").trim(),
      streamType: normalizeTimetableStreamType(row.Designation)
    };

    uniqueOptions.set(
      normalizeTimetableLookupKey(classCode || className),
      option
    );
  });

  timetableRows.forEach((row) => {
    const classCode = String(row.class_code ?? "").trim();
    const className = String(row.class_name ?? "").trim();

    if (!classCode && !className) {
      return;
    }

    const key = normalizeTimetableLookupKey(classCode || className);
    if (uniqueOptions.has(key)) {
      return;
    }

    uniqueOptions.set(key, {
      classCode,
      className,
      yearGroup: String(row.year_group ?? "").trim(),
      streamType: normalizeTimetableStreamType(row.stream_type)
    });
  });

  return Array.from(uniqueOptions.values()).sort((left, right) =>
    [left.yearGroup, left.className, left.classCode]
      .join("|")
      .localeCompare([right.yearGroup, right.className, right.classCode].join("|"), undefined, {
        numeric: true
      })
  );
}

export async function createStaffDirectoryRecord(
  input: StaffDirectoryUpsertInput
): Promise<StaffDirectoryRecord> {
  const supabase = createSupabaseAdminClient();
  const id = normalizeOptionalText(input.id) ?? `staff-${randomUUID()}`;
  const nextStaffId = normalizeOptionalText(input.staff_id) ?? await getNextStaffDirectoryStaffId(supabase);
  const payload = {
    id,
    ...buildStaffDirectoryPayload(input),
    staff_id: nextStaffId
  };

  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .insert(payload)
    .select(
      "id,staff_id,name,first_name,role,email,department,class,extension,max_duties,status,unavailable_reason,timetable,photo_url,designation,system_role"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = normalizeStaffProfile((data ?? {}) as Record<string, unknown>);

  return {
    ...profile,
    assigned_duties: []
  };
}

export async function updateStaffDirectoryRecord(
  id: string,
  input: StaffDirectoryUpsertInput
): Promise<StaffDirectoryRecord> {
  const supabase = createSupabaseAdminClient();
  const normalizedId = normalizeRequiredText(id, "Staff ID");
  const payload = buildStaffDirectoryPayload(input);

  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .update(payload)
    .eq("id", normalizedId)
    .select(
      "id,staff_id,name,first_name,role,email,department,class,extension,max_duties,status,unavailable_reason,timetable,photo_url,designation,system_role"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = normalizeStaffProfile((data ?? {}) as Record<string, unknown>);

  return {
    ...profile,
    assigned_duties: []
  };
}

export async function deleteStaffDirectoryRecord(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const normalizedId = normalizeRequiredText(id, "Staff ID");

  const { error } = await supabase.from(STAFF_TABLE).delete().eq("id", normalizedId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getDutyRosterData(): Promise<DutyRosterRecord[]> {
  const [staff, duties] = await Promise.all([getStaffDirectoryData(), getActiveDutyRows()]);

  const staffLookup = new Map(
    staff.map((person) => [
      person.id,
      {
        name: person.name,
        first_name: person.first_name,
        department: person.department,
        photo_url: person.photo_url
      }
    ])
  );

  return duties.map((duty) => {
    const assignedStaff = duty.assignedStaffId ? staffLookup.get(duty.assignedStaffId) : null;

    return {
      ...duty,
      assignedStaffName: assignedStaff?.name ?? null,
      assignedStaffFirstName: assignedStaff?.first_name ?? null,
      assignedStaffDepartment: assignedStaff?.department ?? null,
      assignedStaffPhotoUrl: assignedStaff?.photo_url ?? null,
      isAssigned: Boolean(duty.assignedStaffId && assignedStaff)
    };
  });
}

export async function getDutyRosterViewData(): Promise<DutyRosterViewData> {
  const supabase = createSupabaseAdminClient();
  const [staff, { data, error }] = await Promise.all([
    getStaffDirectoryData(),
    supabase
      .from(DUTIES_TABLE)
      .select(
        "id,name,duty_name,description,first_location,second_location,start_time,end_time,days_of_week,day_of_week,assigned_staff_id,is_active,color,category,parent_duty_id,is_day_instance,sort_order,day_order,duty_order,daily_order_number,unique_duty_id"
      )
      .eq("is_active", true)
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const staffLookup = new Map(
    staff.map((person) => [
      person.id,
      {
        name: person.name,
        first_name: person.first_name,
        department: person.department,
        photo_url: person.photo_url
      }
    ])
  );

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const rowById = new Map(rows.map((row) => [String(row.id), row]));
  const topLevelRows = rows.filter((row) => !row.parent_duty_id);
  const nonDayRows = rows.filter((row) => row.parent_duty_id && !row.is_day_instance);
  const dayRows = rows.filter((row) => row.is_day_instance);

  const assignmentFor = (row: Record<string, unknown>): DutyRosterAssignment => {
    const assignedStaffId = row.assigned_staff_id ? String(row.assigned_staff_id) : null;
    const assignedStaff = assignedStaffId ? staffLookup.get(assignedStaffId) : null;

    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? row.duty_name ?? "Duty"),
      location: formatDutyLocation(
        row.first_location ? String(row.first_location) : null,
        row.second_location ? String(row.second_location) : null
      ),
      dayLabel: formatDayLabel(row.day_of_week ? String(row.day_of_week) : null),
      timeLabel:
        row.start_time && row.end_time
          ? `${String(row.start_time)} - ${String(row.end_time)}`
          : row.start_time
            ? String(row.start_time)
            : "Time TBC",
      category: row.category ? String(row.category) : null,
      color: row.color ? String(row.color) : null,
      assignedStaffId,
      assignedStaffName: assignedStaff?.name ?? null,
      assignedStaffFirstName: assignedStaff?.first_name ?? null,
      assignedStaffDepartment: assignedStaff?.department ?? null,
      assignedStaffPhotoUrl: assignedStaff?.photo_url ?? null,
      isAssigned: Boolean(assignedStaffId && assignedStaff),
      uniqueDutyId: row.unique_duty_id ? String(row.unique_duty_id) : null,
      dayOfWeek: row.day_of_week ? String(row.day_of_week) : null,
      dayOrder:
        typeof row.day_order === "number" ? row.day_order : row.day_order ? Number(row.day_order) : null,
      dailyOrderNumber:
        typeof row.daily_order_number === "number"
          ? row.daily_order_number
          : row.daily_order_number
            ? Number(row.daily_order_number)
            : null
    };
  };

  const groups = topLevelRows
    .map((parent): DutyRosterGroup => {
      const subGroups = nonDayRows
        .filter((row) => String(row.parent_duty_id) === String(parent.id))
        .map((sub): DutyRosterSubGroup => {
          const assignments = dayRows
            .filter((row) => String(row.parent_duty_id) === String(sub.id))
            .map(assignmentFor)
            .sort((left, right) => {
              const daySort = (left.dayOrder ?? 99) - (right.dayOrder ?? 99);
              if (daySort !== 0) {
                return daySort;
              }
              return (left.dailyOrderNumber ?? 0) - (right.dailyOrderNumber ?? 0);
            });

          return {
            id: String(sub.id ?? ""),
            name: String(sub.name ?? sub.duty_name ?? "Duty"),
            location: formatDutyLocation(
              sub.first_location ? String(sub.first_location) : null,
              sub.second_location ? String(sub.second_location) : null
            ),
            dutyOrder:
              typeof sub.duty_order === "number"
                ? sub.duty_order
                : sub.duty_order
                  ? Number(sub.duty_order)
                  : null,
            color: sub.color ? String(sub.color) : null,
            assignments
          };
        })
        .sort((left, right) => (left.dutyOrder ?? 99) - (right.dutyOrder ?? 99));

      return {
        id: String(parent.id ?? ""),
        name: String(parent.name ?? parent.duty_name ?? "Duty Group"),
        description: parent.description ? String(parent.description) : null,
        sortOrder:
          typeof parent.sort_order === "number"
            ? parent.sort_order
            : parent.sort_order
              ? Number(parent.sort_order)
              : null,
        timeLabel:
          parent.start_time && parent.end_time
            ? `${String(parent.start_time)} - ${String(parent.end_time)}`
            : parent.start_time
              ? String(parent.start_time)
              : "Time TBC",
        daysLabel: formatDaysSummary(parent.days_of_week ? String(parent.days_of_week) : null),
        color: parent.color ? String(parent.color) : null,
        subGroups
      };
    })
    .sort((left, right) => (left.sortOrder ?? 99) - (right.sortOrder ?? 99));

  const dutyGroupOptions = groups.map((group) => ({
    id: group.id,
    label: `${group.name} (${group.timeLabel})`
  }));

  const seenStaff = new Set<string>();
  const staffOptions: DutyRosterStaffOption[] = [];
  const departmentSet = new Set<string>();

  groups.forEach((group) => {
    group.subGroups.forEach((subGroup) => {
      subGroup.assignments.forEach((assignment) => {
        if (assignment.assignedStaffDepartment) {
          departmentSet.add(assignment.assignedStaffDepartment);
        }

        if (!assignment.assignedStaffId || seenStaff.has(assignment.assignedStaffId)) {
          return;
        }

        seenStaff.add(assignment.assignedStaffId);
        staffOptions.push({
          id: assignment.assignedStaffId,
          label: `${assignment.assignedStaffFirstName ?? assignment.assignedStaffName ?? "Staff"} (${assignment.assignedStaffDepartment ?? "Staff"})`,
          firstName: assignment.assignedStaffFirstName,
          department: assignment.assignedStaffDepartment
        });
      });
    });
  });

  staffOptions.sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  return {
    groups,
    dutyGroupOptions,
    staffOptions,
    departmentOptions: Array.from(departmentSet).sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true })
    )
  };
}

async function getTimetableTemplatesStrict(): Promise<TimetableTemplate[]> {
  const supabase = createSupabaseAdminClient();
  const attempts: Array<{
    select: string;
    useIsActiveFilter?: boolean;
    useYearGroupSort?: boolean;
    defaults?: Record<string, unknown>;
  }> = [
    {
      select: "id,name,school,designation,year_group,is_active",
      useIsActiveFilter: true,
      useYearGroupSort: true
    },
    {
      select: "id,name,school,designation,year_group",
      useYearGroupSort: true,
      defaults: { is_active: true }
    },
    {
      select: "id,name,school,designation,is_active",
      useIsActiveFilter: true,
      defaults: { year_group: null }
    },
    {
      select: "id,name,school,designation",
      defaults: { year_group: null, is_active: true }
    },
    {
      select: "id,name,year_group,is_active",
      useIsActiveFilter: true,
      useYearGroupSort: true,
      defaults: { school: null, designation: null }
    },
    {
      select: "id,name,year_group",
      useYearGroupSort: true,
      defaults: { school: null, designation: null, is_active: true }
    },
    {
      select: "id,name,is_active",
      useIsActiveFilter: true,
      defaults: { school: null, designation: null, year_group: null }
    },
    {
      select: "id,name",
      defaults: { school: null, designation: null, year_group: null, is_active: true }
    }
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    let query = supabase.from(TIMETABLE_TEMPLATES_TABLE).select(attempt.select);

    if (attempt.useIsActiveFilter) {
      query = query.eq("is_active", true);
    }

    if (attempt.useYearGroupSort) {
      query = query.order("year_group", { ascending: true });
    }

    const result = await query.order("name");

    if (result.error) {
      lastError = new Error(result.error.message);
      continue;
    }

    return ((result.data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
      normalizeTimetableTemplate({
        ...attempt.defaults,
        ...row
      })
    );
  }

  throw lastError ?? new Error("Unable to load timetable templates.");
}

export async function getTimetableTemplates(): Promise<TimetableTemplate[]> {
  return getTimetableTemplatesStrict();
}

export async function getTimetableStaffOptions(): Promise<TimetableStaffOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("id,name,first_name,department,photo_url")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    label: `${row.first_name ? String(row.first_name) : String(row.name ?? "Staff")}${row.department ? ` (${String(row.department)})` : ""}`,
    firstName: row.first_name ? String(row.first_name) : null,
    department: row.department ? String(row.department) : null,
    photoUrl: row.photo_url ? String(row.photo_url) : null
  }));
}

async function selectClassTimetableRows(): Promise<
  Array<Record<string, unknown> & { class_code: string | null; class_name: string }>
> {
  const supabase = createSupabaseAdminClient();
  const attempts: Array<{
    select: string;
    defaults?: Record<string, unknown>;
  }> = [
    {
      select: "id,class_code,class_name,template_id,stream_type,created_at,updated_at"
    },
    {
      select: "id,class_code,class_name,template_id,created_at,updated_at",
      defaults: { stream_type: null }
    },
    {
      select: "id,class_name,template_id,created_at,updated_at",
      defaults: { class_code: null, stream_type: null }
    }
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const result = await supabase.from(CLASS_TIMETABLES_TABLE).select(attempt.select);

    if (result.error) {
      lastError = new Error(result.error.message);
      continue;
    }

    return ((result.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      ...attempt.defaults,
      ...row,
      class_code: row.class_code ? String(row.class_code) : attempt.defaults?.class_code ? String(attempt.defaults.class_code) : null,
      class_name: row.class_name ? String(row.class_name) : "",
      stream_type: row.stream_type ?? attempt.defaults?.stream_type ?? null
    }));
  }

  throw lastError ?? new Error("Unable to load class timetables.");
}

async function buildTimetableClassSummaries(params: {
  classRecords: ClassRecord[];
  templates: TimetableTemplate[];
}): Promise<TimetableClassSummary[]> {
  const { classRecords, templates } = params;
  const timetableRows = await selectClassTimetableRows();

  const templateLookup = new Map(templates.map((template) => [template.id, template]));
  const timetableByClassKey = new Map<
    string,
    {
      id: string;
      classCode: string | null;
      className: string;
      templateId: string | null;
      streamType: TimetableStreamType | null;
    }
  >();

  timetableRows.forEach((row) => {
    const entry = {
      id: String(row.id ?? ""),
      classCode: row.class_code,
      className: row.class_name,
      templateId: row.template_id ? String(row.template_id) : null,
      streamType: normalizeTimetableStreamType(row.stream_type)
    };

    const rowKeys = new Set([
      ...buildTimetableLookupKeys(row.class_code),
      ...buildTimetableLookupKeys(row.class_name)
    ]);

    rowKeys.forEach((key) => {
      timetableByClassKey.set(key, entry);
    });
  });

  return classRecords
    .map((row) => {
      const classKeys = [
        ...buildTimetableLookupKeys(row["Class Code"]),
        ...buildTimetableLookupKeys(row["Class Name"])
      ];
      const timetable = classKeys
        .map((key) => timetableByClassKey.get(key) ?? null)
        .find((entry) => entry !== null) ?? null;
      const template = timetable?.templateId ? templateLookup.get(timetable.templateId) : null;

      return {
        classCode: row["Class Code"],
        className: row["Class Name"],
        school: row.School,
        designation: titleCaseWords(timetable?.streamType ?? row.Designation),
        yearGroup: row["Year Group"],
        milepost: row.Milepost,
        level: row.Level,
        streamType: timetable?.streamType ?? normalizeTimetableStreamType(row.Designation),
        hasTimetable: Boolean(timetable),
        timetableId: timetable?.id ?? null,
        templateId: timetable?.templateId ?? null,
        templateName: template?.name ?? null
      };
    })
    .sort(compareTimetableClassSummaries);
}

export async function getTimetableClassSummaries(): Promise<TimetableClassSummary[]> {
  const [classRecords, templates] = await Promise.all([getClassRecords(), getTimetableTemplatesStrict()]);
  return buildTimetableClassSummaries({ classRecords, templates });
}

export async function getTimetableAdminData(): Promise<{
  classes: TimetableClassSummary[];
  templates: TimetableTemplate[];
  setupMessage: string | null;
}> {
  const classRecords = await getClassRecords();
  let setupMessage: string | null = null;
  let templates: TimetableTemplate[] = [];

  try {
    templates = await getTimetableTemplatesStrict();
  } catch (error) {
    if (isMissingSupabaseRelationError(error, TIMETABLE_TEMPLATES_TABLE)) {
      setupMessage = TIMETABLE_SETUP_MESSAGE;
    } else {
      throw error;
    }
  }

  try {
    const classes = await buildTimetableClassSummaries({ classRecords, templates });

    return {
      classes,
      templates,
      setupMessage
    };
  } catch (error) {
    if (isMissingSupabaseRelationError(error, CLASS_TIMETABLES_TABLE)) {
      return {
        classes: classRecords
          .map((row) => ({
            classCode: row["Class Code"],
            className: row["Class Name"],
            school: row.School,
            designation: row.Designation,
            yearGroup: row["Year Group"],
            milepost: row.Milepost,
            level: row.Level,
            streamType: normalizeTimetableStreamType(row.Designation),
            hasTimetable: false,
            timetableId: null,
            templateId: null,
            templateName: null
          }))
          .sort(compareTimetableClassSummaries),
        templates,
        setupMessage: setupMessage ?? TIMETABLE_SETUP_MESSAGE
      };
    }

    throw error;
  }
}

async function getClassTimetableRecordByClassCode(classCode: string, classNameFallback?: string | null) {
  const lookupKeys = new Set([
    ...buildTimetableLookupKeys(classCode),
    ...buildTimetableLookupKeys(classNameFallback)
  ]);
  const timetableRows = await selectClassTimetableRows();

  return (
    timetableRows.find((row) =>
      [...buildTimetableLookupKeys(row.class_code), ...buildTimetableLookupKeys(row.class_name)].some((key) =>
        lookupKeys.has(key)
      )
    ) ??
    null
  );
}

async function getTimetablePeriodsByTemplate(templateId: string): Promise<TimetablePeriod[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TIMETABLE_PERIODS_TABLE)
    .select("id,template_id,weekday,label,start_time,end_time,block_type,sort_order")
    .eq("template_id", templateId)
    .order("weekday")
    .order("sort_order")
    .order("start_time");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeTimetablePeriod)
    .sort((left, right) => {
      const daySort = weekdaySortValue(left.weekday) - weekdaySortValue(right.weekday);
      if (daySort !== 0) {
        return daySort;
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.start_time.localeCompare(right.start_time);
    });
}

async function getTimetableBlocksForTimetable(
  classTimetableId: string,
  periods: TimetablePeriod[]
): Promise<TimetableBlock[]> {
  const supabase = createSupabaseAdminClient();
  const [{ data: blockRows, error: blockError }, { data: linkRows, error: linkError }, staffOptions] =
    await Promise.all([
      supabase
        .from(TIMETABLE_BLOCKS_TABLE)
        .select(
          "id,class_timetable_id,period_id,title,block_type,color,notes,start_time_override,end_time_override"
        )
        .eq("class_timetable_id", classTimetableId),
      supabase
        .from(TIMETABLE_BLOCK_STAFF_TABLE)
        .select("block_id,staff_id")
        .in(
          "block_id",
          (
            await supabase
              .from(TIMETABLE_BLOCKS_TABLE)
              .select("id")
              .eq("class_timetable_id", classTimetableId)
          ).data?.map((row) => row.id) ?? [""]
        ),
      getTimetableStaffOptions()
    ]);

  if (blockError) {
    throw new Error(blockError.message);
  }

  if (linkError) {
    throw new Error(linkError.message);
  }

  const periodLookup = new Map(periods.map((period) => [period.id, period]));
  const staffLookup = new Map(
    staffOptions.map((option) => [
      option.id,
      {
        staff_id: option.id,
        staff_name: option.label.replace(/\s+\([^)]*\)$/, ""),
        staff_first_name: option.firstName,
        department: option.department,
        photo_url: option.photoUrl
      }
    ])
  );
  const teachersByBlock = new Map<string, TimetableBlockStaffAssignment[]>();

  ((linkRows ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const blockId = String(row.block_id ?? "");
    const staffId = String(row.staff_id ?? "");
    const teacher = staffLookup.get(staffId);

    if (!teacher) {
      return;
    }

    const current = teachersByBlock.get(blockId) ?? [];
    current.push(teacher);
    teachersByBlock.set(blockId, current);
  });

  return ((blockRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const period = periodLookup.get(String(row.period_id ?? ""));
      if (!period) {
        return null;
      }

      return {
        id: String(row.id ?? ""),
        class_timetable_id: String(row.class_timetable_id ?? ""),
        period_id: String(row.period_id ?? ""),
        weekday: period.weekday,
        period_label: period.label,
        start_time: period.start_time,
        end_time: period.end_time,
        block_type: normalizeTimetableBlockType(row.block_type ?? period.block_type),
        title: row.title ? String(row.title) : null,
        color: resolveTimetableColor(
          row.title ? String(row.title) : null,
          row.color ? String(row.color) : null,
          normalizeTimetableBlockType(row.block_type ?? period.block_type)
        ),
        notes: row.notes ? String(row.notes) : null,
        start_time_override: row.start_time_override ? String(row.start_time_override) : null,
        end_time_override: row.end_time_override ? String(row.end_time_override) : null,
        sort_order: period.sort_order,
        teachers: teachersByBlock.get(String(row.id ?? "")) ?? []
      } satisfies TimetableBlock;
    })
    .filter((block): block is TimetableBlock => Boolean(block))
    .sort((left, right) => {
      const daySort = weekdaySortValue(left.weekday) - weekdaySortValue(right.weekday);
      if (daySort !== 0) {
        return daySort;
      }

      return left.sort_order - right.sort_order;
    });
}

export async function getTimetableBuilderData(classCode: string): Promise<TimetableBuilderData> {
  const normalizedIdentifier = classCode.trim();
  const [classSummaries, templates, staffOptions] = await Promise.all([
    getTimetableClassSummaries(),
    getTimetableTemplates(),
    getTimetableStaffOptions()
  ]);

  const classSummary =
    classSummaries.find((entry) => entry.classCode === normalizedIdentifier) ??
    classSummaries.find((entry) => entry.className === normalizedIdentifier);
  if (!classSummary) {
    throw new Error(`Class identifier ${normalizedIdentifier} was not found.`);
  }

  const classTimetableRow = await getClassTimetableRecordByClassCode(
    classSummary.classCode,
    classSummary.className
  );
  const templateLookup = new Map(templates.map((template) => [template.id, template]));
  const timetable = classTimetableRow ? normalizeClassTimetable(classTimetableRow, templateLookup) : null;
  const periods = timetable ? await getTimetablePeriodsByTemplate(timetable.template_id) : [];
  const blocks = timetable ? await getTimetableBlocksForTimetable(timetable.id, periods) : [];

  return {
    classSummary,
    templates,
    timetable,
    periods,
    blocks,
    staffOptions,
    subjectTargets: DEFAULT_TIMETABLE_SUBJECT_TARGETS
  };
}

export async function createClassTimetable(input: { classCode: string; templateId: string }) {
  const classCode = input.classCode.trim();
  if (!classCode) {
    throw new Error("classCode is required.");
  }

  if (!input.templateId) {
    throw new Error("templateId is required.");
  }

  const [classSummaries, templates, periods] = await Promise.all([
    getTimetableClassSummaries(),
    getTimetableTemplates(),
    getTimetablePeriodsByTemplate(input.templateId)
  ]);

  const classSummary = classSummaries.find((entry) => entry.classCode === classCode);
  if (!classSummary) {
    throw new Error(`Class code ${classCode} was not found.`);
  }

  const existingTimetable = await getClassTimetableRecordByClassCode(classCode, classSummary.className);

  if (!templates.some((template) => template.id === input.templateId)) {
    throw new Error("Selected timetable template was not found.");
  }

  if (existingTimetable) {
    throw new Error(`A timetable already exists for ${classSummary.className}.`);
  }

  if (!periods.length) {
    throw new Error("Selected template has no periods.");
  }

  const supabase = createSupabaseAdminClient();
  let data: Record<string, unknown> | null = null;
  const currentSchemaInsert = await supabase
    .from(CLASS_TIMETABLES_TABLE)
    .insert({
      class_code: classCode,
      class_name: classSummary.className,
      template_id: input.templateId
    })
    .select("id,class_code,class_name,template_id,created_at,updated_at")
    .single();

  if (!currentSchemaInsert.error) {
    data = (currentSchemaInsert.data as Record<string, unknown> | null) ?? null;
  } else if (isMissingSupabaseColumnError(currentSchemaInsert.error, CLASS_TIMETABLES_TABLE, "class_code")) {
    const legacyInsert = await supabase
      .from(CLASS_TIMETABLES_TABLE)
      .insert({
        class_name: classSummary.className,
        template_id: input.templateId
      })
      .select("id,class_name,template_id,created_at,updated_at")
      .single();

    if (legacyInsert.error) {
      throw new Error(legacyInsert.error.message);
    }

    data = legacyInsert.data as Record<string, unknown>;
  } else {
    throw new Error(currentSchemaInsert.error.message);
  }

  if (!data) {
    throw new Error("Timetable could not be created.");
  }

  const classTimetableId = String(data.id);
  const blockRows = periods.map((period) => {
    const blockType = normalizeTimetableBlockType(period.block_type);
    return {
      class_timetable_id: classTimetableId,
      period_id: period.id,
      title: defaultTitleForTimetableType({ blockType, periodLabel: period.label }),
      block_type: blockType,
      color: defaultColorForTimetableType(blockType),
      notes: null,
      start_time_override: null,
      end_time_override: null
    };
  });

  const { error: blockError } = await supabase.from(TIMETABLE_BLOCKS_TABLE).insert(blockRows);
  if (blockError) {
    throw new Error(blockError.message);
  }

  return data;
}

export async function deleteClassTimetable(input: { classCode: string }) {
  const classCode = input.classCode.trim();
  if (!classCode) {
    throw new Error("classCode is required.");
  }

  const classSummaries = await getTimetableClassSummaries();
  const classSummary = classSummaries.find((entry) => entry.classCode === classCode);
  const classTimetable = await getClassTimetableRecordByClassCode(classCode, classSummary?.className ?? null);
  if (!classTimetable) {
    throw new Error(`No timetable exists for ${classSummary?.className ?? classCode}.`);
  }

  const supabase = createSupabaseAdminClient();
  const currentSchemaDelete = await supabase
    .from(CLASS_TIMETABLES_TABLE)
    .delete()
    .eq("id", String(classTimetable.id))
    .eq("class_code", classCode);

  if (!currentSchemaDelete.error) {
    return;
  }

  if (!isMissingSupabaseColumnError(currentSchemaDelete.error, CLASS_TIMETABLES_TABLE, "class_code")) {
    throw new Error(currentSchemaDelete.error.message);
  }

  const legacyDelete = await supabase
    .from(CLASS_TIMETABLES_TABLE)
    .delete()
    .eq("id", String(classTimetable.id))
    .eq("class_name", String(classTimetable.class_name ?? ""));

  if (legacyDelete.error) {
    throw new Error(legacyDelete.error.message);
  }
}

export async function bulkImportSpecialistCsv(input: { csvText: string }) {
  const rows = parseCsvRows(input.csvText);
  if (rows.length < 2) {
    throw new Error("The CSV file is empty or could not be read.");
  }

  const headerRow = rows.find((row) => row[1]?.trim().toLowerCase() === "time");
  if (!headerRow) {
    throw new Error("Could not find the timetable header row in the CSV.");
  }

  const headerIndex = rows.indexOf(headerRow);
  const weekdayColumns = headerRow
    .map((value, index) => ({
      index,
      weekday: value.trim().toLowerCase()
    }))
    .filter((entry) =>
      ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(entry.weekday)
    );

  if (!weekdayColumns.length) {
    throw new Error("Could not find weekday columns in the CSV.");
  }

  const timetableClasses = (await getTimetableClassSummaries()).filter((entry) => entry.hasTimetable);
  const timetableClassByName = new Map(timetableClasses.map((entry) => [entry.className, entry]));
  const knownClassNames = timetableClasses
    .map((entry) => entry.className)
    .sort((left, right) => right.length - left.length);

  const assignments: Array<{
    classCode: string;
    className: string;
    weekday: string;
    startTime: string;
    endTime: string;
    subject: string;
  }> = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    const timeValue = row[1]?.trim() ?? "";
    const timeRange = normalizeCsvTimeRange(timeValue);
    if (!timeRange) {
      return;
    }

    weekdayColumns.forEach(({ index, weekday }) => {
      const rawCell = row[index]?.trim() ?? "";
      if (!rawCell) {
        return;
      }

      rawCell
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((line) => {
          const compactLine = line.replace(/\s+/g, " ").trim();
          if (
            /break|lunch|dismissal/i.test(compactLine) &&
            !/^library\s+/i.test(compactLine)
          ) {
            return;
          }

          const matchedClasses = knownClassNames.filter((className) => compactLine.includes(className));
          if (!matchedClasses.length) {
            return;
          }

          const firstMatchIndex = matchedClasses.reduce((lowest, className) => {
            const indexValue = compactLine.indexOf(className);
            return lowest === -1 || indexValue < lowest ? indexValue : lowest;
          }, -1);

          const subject = normalizeSpecialistSubjectLabel(
            compactLine.slice(0, firstMatchIndex).replace(/[,\s]+$/, "")
          );

          matchedClasses.forEach((className) => {
            const classSummary = timetableClassByName.get(className);
            if (!classSummary) {
              return;
            }

            assignments.push({
              classCode: classSummary.classCode,
              className,
              weekday,
              startTime: timeRange.startTime,
              endTime: timeRange.endTime,
              subject
            });
          });
        });
    });
  });

  if (!assignments.length) {
    throw new Error("No specialist lesson assignments were found in the CSV.");
  }

  const classCodes = Array.from(new Set(assignments.map((entry) => entry.classCode)));
  const summaryByClass = new Map(
    classCodes.map((classCode) => [
      classCode,
      {
        className: assignments.find((entry) => entry.classCode === classCode)?.className ?? classCode,
        updatedCount: 0
      }
    ])
  );

  for (const classCode of classCodes) {
    const builderData = await getTimetableBuilderData(classCode);
    if (!builderData.timetable) {
      continue;
    }

    const classAssignments = assignments.filter((entry) => entry.classCode === classCode);
    const assignmentBySlot = new Map(
      classAssignments.map((entry) => [
        `${entry.weekday}|${normalizeTimeKey(entry.startTime)}|${normalizeTimeKey(entry.endTime)}`,
        entry
      ])
    );

    for (const block of builderData.blocks) {
      const slotKey = `${block.weekday}|${normalizeTimeKey(block.start_time)}|${normalizeTimeKey(block.end_time)}`;
      const assignment = assignmentBySlot.get(slotKey);
      if (!assignment) {
        continue;
      }

      await upsertTimetableBlock({
        classCode,
        blockId: block.id,
        title: assignment.subject,
        blockType: "lesson",
        color: specialistSubjectColor(assignment.subject),
        notes: "Imported from specialist timetable CSV.",
        staffIds: []
      });

      const summary = summaryByClass.get(classCode);
      if (summary) {
        summary.updatedCount += 1;
      }
    }
  }

  const updatedBlockCount = Array.from(summaryByClass.values()).reduce(
    (total, summary) => total + summary.updatedCount,
    0
  );

  if (!updatedBlockCount) {
    throw new Error(
      "The CSV was read, but none of its lesson times matched the timetable blocks. Please check that the class timetables use the correct template timings."
    );
  }

  return {
    importedClassCount: classCodes.length,
    assignmentCount: assignments.length,
    updatedBlockCount,
    classes: Array.from(summaryByClass.values())
  };
}

export async function exportClassTimetableCsv(input: { classCode: string }) {
  const builderData = await getTimetableBuilderData(input.classCode);
  if (!builderData.timetable) {
    throw new Error(`No timetable exists for ${builderData.classSummary.className}.`);
  }

  const rows = [
    [
      "Class Code",
      "Class Name",
      "Weekday",
      "Start Time",
      "End Time",
      "Lesson Title",
      "Block Type",
      "Teacher IDs",
      "Color",
      "Notes"
    ].join(",")
  ];

  builderData.blocks.forEach((block) => {
    rows.push(
      [
        csvEscape(builderData.classSummary.classCode),
        csvEscape(builderData.classSummary.className),
        csvEscape(csvWeekdayLabel(block.weekday)),
        csvEscape(csvTimeLabel(block.start_time)),
        csvEscape(csvTimeLabel(block.end_time)),
        csvEscape(block.title ?? ""),
        csvEscape(block.block_type),
        csvEscape(block.teachers.map((teacher) => teacher.staff_id).join(" | ")),
        csvEscape(block.color ?? ""),
        csvEscape(block.notes ?? "")
      ].join(",")
    );
  });

  return {
    classCode: builderData.classSummary.classCode,
    className: builderData.classSummary.className,
    filename: classCsvFilename(builderData.classSummary.className),
    csvText: rows.join("\n")
  };
}

export async function importClassTimetableCsv(input: { classCode: string; csvText: string }) {
  const rows = parseCsvRows(input.csvText);
  if (rows.length < 2) {
    throw new Error("The CSV file is empty or could not be read.");
  }

  const builderData = await getTimetableBuilderData(input.classCode);
  if (!builderData.timetable) {
    throw new Error(`No timetable exists for ${builderData.classSummary.className}.`);
  }

  const headerLookup = new Map(
    rows[0].map((cell, index) => [normalizeClassCsvHeader(cell), index] as const)
  );
  const requiredHeaders = [
    "class code",
    "class name",
    "weekday",
    "start time",
    "end time",
    "lesson title",
    "block type",
    "teacher ids",
    "color",
    "notes"
  ];

  const missingHeader = requiredHeaders.find((header) => !headerLookup.has(header));
  if (missingHeader) {
    throw new Error(`The CSV is missing the "${missingHeader}" column.`);
  }

  const blockBySlot = new Map(
    builderData.blocks.map((block) => [
      `${block.weekday}|${normalizeTimeKey(block.start_time)}|${normalizeTimeKey(block.end_time)}`,
      block
    ])
  );
  const staffById = new Map(builderData.staffOptions.map((option) => [option.id, option]));
  type ImportIssue = {
    rowNumber: number;
    slot: string;
    reason: string;
  };

  const issues: ImportIssue[] = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let processedRowCount = 0;
  const seenSlots = new Set<string>();

  for (const [rowOffset, row] of rows.slice(1).entries()) {
    const rowNumber = rowOffset + 2;
    const classCode = String(row[headerLookup.get("class code") ?? -1] ?? "").trim();
    const className = String(row[headerLookup.get("class name") ?? -1] ?? "").trim();
    const weekdayLabel = String(row[headerLookup.get("weekday") ?? -1] ?? "").trim().toLowerCase();
    const startTimeRaw = String(row[headerLookup.get("start time") ?? -1] ?? "").trim();
    const endTimeRaw = String(row[headerLookup.get("end time") ?? -1] ?? "").trim();
    const lessonTitle = String(row[headerLookup.get("lesson title") ?? -1] ?? "").trim();
    const blockTypeRaw = String(row[headerLookup.get("block type") ?? -1] ?? "").trim();
    const teacherIdsRaw = String(row[headerLookup.get("teacher ids") ?? -1] ?? "").trim();
    const color = String(row[headerLookup.get("color") ?? -1] ?? "").trim();
    const notes = String(row[headerLookup.get("notes") ?? -1] ?? "").trim();
    const slotLabel = `${csvWeekdayLabel(weekdayLabel)} ${startTimeRaw}-${endTimeRaw}`.trim();

    if (!classCode && !className && !weekdayLabel && !startTimeRaw && !endTimeRaw) {
      continue;
    }

    processedRowCount += 1;

    if (classCode && classCode !== builderData.classSummary.classCode) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: `CSV class code ${classCode} does not match selected class ${builderData.classSummary.classCode}.`
      });
      continue;
    }

    if (className && className !== builderData.classSummary.className) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: `CSV class name ${className} does not match selected class ${builderData.classSummary.className}.`
      });
      continue;
    }

    const startTime = normalizeCsvTimeValue(startTimeRaw);
    const endTime = normalizeCsvTimeValue(endTimeRaw);
    if (!startTime || !endTime) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: `Could not read timetable times ${startTimeRaw}-${endTimeRaw}.`
      });
      continue;
    }

    const slotKey = `${weekdayLabel}|${normalizeTimeKey(startTime)}|${normalizeTimeKey(endTime)}`;
    if (seenSlots.has(slotKey)) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: "The CSV contains a duplicate row for this timetable slot."
      });
      continue;
    }
    seenSlots.add(slotKey);

    const block = blockBySlot.get(slotKey);
    if (!block) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: "This timetable slot does not exist for the selected class."
      });
      continue;
    }

    try {
      const normalizedBlockType = normalizeTimetableBlockType(blockTypeRaw || block.block_type);
      const teacherIdsFromCsv = splitTeacherCsvValue(teacherIdsRaw);
      const resolvedTeacherIds: string[] = [];

      if (teacherIdsFromCsv.length > 0) {
        teacherIdsFromCsv.forEach((teacherId) => {
          if (!staffById.has(teacherId)) {
            throw new Error(`Teacher ID ${teacherId} is not valid for ${builderData.classSummary.className}.`);
          }
          if (!resolvedTeacherIds.includes(teacherId)) {
            resolvedTeacherIds.push(teacherId);
          }
        });
      }

      const nextTitle = lessonTitle ? lessonTitle : block.title;
      const nextColor = resolveTimetableColor(nextTitle, color ? color : block.color, normalizedBlockType);
      const nextNotes = notes ? notes : block.notes;
      const currentTeacherIds = block.teachers.map((teacher) => teacher.staff_id);
      const nextTeacherIds = teacherIdsFromCsv.length > 0 ? resolvedTeacherIds : currentTeacherIds;

      const changedFields: string[] = [];
      if ((nextTitle ?? block.period_label) !== (block.title ?? block.period_label)) {
        changedFields.push("title");
      }
      if (normalizedBlockType !== block.block_type) {
        changedFields.push("block type");
      }
      if ((nextColor ?? "") !== (block.color ?? "")) {
        changedFields.push("color");
      }
      if ((nextNotes ?? "") !== (block.notes ?? "")) {
        changedFields.push("notes");
      }
      if (JSON.stringify(nextTeacherIds) !== JSON.stringify(currentTeacherIds)) {
        changedFields.push("teachers");
      }

      if (!changedFields.length) {
        skippedCount += 1;
        continue;
      }

      await upsertTimetableBlock({
        classCode: builderData.classSummary.classCode,
        blockId: block.id,
        title: nextTitle,
        blockType: normalizedBlockType,
        color: nextColor,
        notes: nextNotes,
        staffIds: nextTeacherIds
      });

      updatedCount += 1;
    } catch (error) {
      issues.push({
        rowNumber,
        slot: slotLabel,
        reason: error instanceof Error ? error.message : "This timetable row could not be imported."
      });
    }
  }

  if (!processedRowCount) {
    throw new Error("The CSV was read, but no timetable rows were found.");
  }

  if (!updatedCount && issues.length) {
    throw new Error(
      `The CSV was read, but no timetable rows were updated. First issue: ${issues[0].slot} - ${issues[0].reason}`
    );
  }

  if (!updatedCount && !issues.length) {
    throw new Error("The CSV was read, but no timetable rows were updated.");
  }

  return {
    classCode: builderData.classSummary.classCode,
    className: builderData.classSummary.className,
    processedRowCount,
    updatedCount,
    skippedCount,
    issues
  };
}

export async function upsertTimetableBlock(input: {
  classCode: string;
  blockId: string;
  title: string | null;
  blockType: TimetableBlockType;
  color: string | null;
  notes?: string | null;
  staffIds: string[];
}) {
  const classCode = input.classCode.trim();
  const classSummaries = await getTimetableClassSummaries();
  const classSummary = classSummaries.find((entry) => entry.classCode === classCode);
  const classTimetable = await getClassTimetableRecordByClassCode(classCode, classSummary?.className ?? null);
  if (!classTimetable) {
    throw new Error(`No timetable exists for ${classSummary?.className ?? classCode}.`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: blockRow, error: blockLookupError } = await supabase
    .from(TIMETABLE_BLOCKS_TABLE)
    .select("id,class_timetable_id,period_id")
    .eq("id", input.blockId)
    .eq("class_timetable_id", String(classTimetable.id))
    .maybeSingle();

  if (blockLookupError) {
    throw new Error(blockLookupError.message);
  }

  if (!blockRow) {
    throw new Error("Selected timetable block was not found.");
  }

  const uniqueStaffIds = Array.from(new Set(input.staffIds.filter(Boolean)));
  if (uniqueStaffIds.length) {
    const { data: staffRows, error: staffError } = await supabase
      .from(STAFF_TABLE)
      .select("id")
      .in("id", uniqueStaffIds);

    if (staffError) {
      throw new Error(staffError.message);
    }

    const validIds = new Set(((staffRows ?? []) as Array<{ id: string }>).map((row) => String(row.id)));
    const invalidId = uniqueStaffIds.find((staffId) => !validIds.has(staffId));
    if (invalidId) {
      throw new Error(`Teacher ${invalidId} is not a valid staff member.`);
    }
  }

  const normalizedBlockType = normalizeTimetableBlockType(input.blockType);
  const normalizedTitle = input.title?.trim()
    ? input.title.trim()
    : defaultTitleForTimetableType({
        blockType: normalizedBlockType,
        periodLabel: ""
      });
  const { error: updateError } = await supabase
    .from(TIMETABLE_BLOCKS_TABLE)
    .update({
      title: normalizedTitle,
      block_type: normalizedBlockType,
      color: resolveTimetableColor(normalizedTitle, input.color ?? null, normalizedBlockType),
      notes: input.notes?.trim() ? input.notes.trim() : null
    })
    .eq("id", input.blockId)
    .eq("class_timetable_id", String(classTimetable.id));

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: deleteLinksError } = await supabase
    .from(TIMETABLE_BLOCK_STAFF_TABLE)
    .delete()
    .eq("block_id", input.blockId);

  if (deleteLinksError) {
    throw new Error(deleteLinksError.message);
  }

  if (uniqueStaffIds.length) {
    const { error: insertLinksError } = await supabase.from(TIMETABLE_BLOCK_STAFF_TABLE).insert(
      uniqueStaffIds.map((staffId) => ({
        block_id: input.blockId,
        staff_id: staffId
      }))
    );

    if (insertLinksError) {
      throw new Error(insertLinksError.message);
    }
  }
}

export async function resetTimetableBlock(input: { classCode: string; blockId: string }) {
  const classSummaries = await getTimetableClassSummaries();
  const classSummary = classSummaries.find((entry) => entry.classCode === input.classCode.trim());
  const classTimetable = await getClassTimetableRecordByClassCode(
    input.classCode.trim(),
    classSummary?.className ?? null
  );
  if (!classTimetable) {
    throw new Error(`No timetable exists for ${classSummary?.className ?? input.classCode}.`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: blockRow, error: blockError } = await supabase
    .from(TIMETABLE_BLOCKS_TABLE)
    .select("id,class_timetable_id,period_id")
    .eq("id", input.blockId)
    .eq("class_timetable_id", String(classTimetable.id))
    .maybeSingle();

  if (blockError) {
    throw new Error(blockError.message);
  }

  if (!blockRow) {
    throw new Error("Selected timetable block was not found.");
  }

  const { data: periodRow, error: periodError } = await supabase
    .from(TIMETABLE_PERIODS_TABLE)
    .select("id,label,block_type")
    .eq("id", String(blockRow.period_id))
    .single();

  if (periodError) {
    throw new Error(periodError.message);
  }

  const blockType = normalizeTimetableBlockType(periodRow.block_type);
  const { error: updateError } = await supabase
    .from(TIMETABLE_BLOCKS_TABLE)
    .update({
      title: defaultTitleForTimetableType({ blockType, periodLabel: String(periodRow.label ?? "") }),
      block_type: blockType,
      color: defaultColorForTimetableType(blockType),
      notes: null,
      start_time_override: null,
      end_time_override: null
    })
    .eq("id", input.blockId)
    .eq("class_timetable_id", String(classTimetable.id));

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: deleteLinksError } = await supabase
    .from(TIMETABLE_BLOCK_STAFF_TABLE)
    .delete()
    .eq("block_id", input.blockId);

  if (deleteLinksError) {
    throw new Error(deleteLinksError.message);
  }
}

export async function getGradebookSubjectById(subjectId: string): Promise<GradebookSubject | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(SUBJECTS_TABLE)
    .select("id,name,slug,class_name,is_core")
    .eq("id", subjectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GradebookSubject | null) ?? null;
}

export async function getGradebookSubjects(className?: string): Promise<GradebookSubject[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(SUBJECTS_TABLE)
    .select("id,name,slug,class_name,is_core")
    .order("is_core", { ascending: false })
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const subjects = (data ?? []) as GradebookSubject[];
  const filtered = subjects.filter((subject) =>
    className ? !subject.class_name || subject.class_name === className : !subject.class_name
  );

  if (!className) {
    return filtered;
  }

  const classSpecificSlugs = new Set(
    filtered.filter((subject) => subject.class_name === className).map((subject) => subject.slug)
  );

  return filtered.filter(
    (subject) => subject.class_name === className || !classSpecificSlugs.has(subject.slug)
  );
}

export async function getGradebookFieldDefinitions(
  subjectId: string
): Promise<GradebookFieldDefinition[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(FIELDS_TABLE)
    .select("id,subject_id,field_key,field_label,field_type,sort_order,is_required")
    .eq("subject_id", subjectId)
    .order("sort_order")
    .order("field_label");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GradebookFieldDefinition[];
}

export async function getGradebookEntries(params: {
  subjectId: string;
  studentIds: string[];
  assessmentName: string;
  assessmentDate: string;
  infoOnly?: boolean;
}): Promise<GradebookEntry[]> {
  if (!params.studentIds.length) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from(ENTRIES_TABLE)
    .select(
      "id,student_school_id,class_name,subject_id,assessment_name,assessment_date,grade,score,comment,field_values"
    )
    .eq("subject_id", params.subjectId)
    .in("student_school_id", params.studentIds);

  if (params.infoOnly) {
    query = query.order("assessment_date", { ascending: false }).order("updated_at", { ascending: false });
  } else {
    if (!params.assessmentName || !params.assessmentDate) {
      return [];
    }

    query = query
      .eq("assessment_name", params.assessmentName)
      .eq("assessment_date", params.assessmentDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const entries = ((data ?? []) as GradebookEntry[]).map((entry) => ({
    ...entry,
    field_values: entry.field_values ?? {}
  }));

  if (!params.infoOnly) {
    return entries;
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.student_school_id)) {
      return false;
    }
    seen.add(entry.student_school_id);
    return true;
  });
}

export async function getGradebookAssessments(params: {
  subjectId: string;
  className?: string;
}): Promise<Array<{ assessment_name: string; assessment_date: string }>> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from(ENTRIES_TABLE)
    .select("assessment_name,assessment_date")
    .eq("subject_id", params.subjectId)
    .order("assessment_date", { ascending: false })
    .order("assessment_name");

  if (params.className) {
    query = query.eq("class_name", params.className);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const seen = new Set<string>();
  return ((data ?? []) as Array<{ assessment_name: string; assessment_date: string }>).filter(
    (item) => {
      const key = `${item.assessment_name}|${item.assessment_date}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }
  );
}

export async function createGradebookSubject(input: {
  name: string;
  className: string | null;
  isCore?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const { data, error } = await supabase
    .from(SUBJECTS_TABLE)
    .insert({
      name: input.name,
      slug,
      class_name: input.className,
      is_core: input.isCore ?? false
    })
    .select("id,name,slug,class_name,is_core")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GradebookSubject;
}

export async function createGradebookFieldDefinition(input: {
  subjectId: string;
  fieldLabel: string;
  fieldType: GradebookFieldDefinition["field_type"];
  isRequired?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const fieldKey = input.fieldLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const existingFields = await getGradebookFieldDefinitions(input.subjectId);
  const sortOrder = existingFields.length + 1;

  const { data, error } = await supabase
    .from(FIELDS_TABLE)
    .insert({
      subject_id: input.subjectId,
      field_key: fieldKey,
      field_label: input.fieldLabel,
      field_type: input.fieldType,
      sort_order: sortOrder,
      is_required: input.isRequired ?? false
    })
    .select("id,subject_id,field_key,field_label,field_type,sort_order,is_required")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GradebookFieldDefinition;
}

export async function upsertGradebookEntry(input: {
  studentSchoolId: string;
  className: string;
  subjectId: string;
  assessmentName: string;
  assessmentDate: string;
  grade: string;
  score: string;
  comment: string;
  fieldValues: Record<string, string>;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(ENTRIES_TABLE)
    .upsert(
      {
        student_school_id: input.studentSchoolId,
        class_name: input.className,
        subject_id: input.subjectId,
        assessment_name: input.assessmentName,
        assessment_date: input.assessmentDate,
        grade: input.grade || null,
        score: input.score || null,
        comment: input.comment || null,
        field_values: input.fieldValues
      },
      {
        onConflict: "student_school_id,subject_id,assessment_name,assessment_date"
      }
    )
    .select(
      "id,student_school_id,class_name,subject_id,assessment_name,assessment_date,grade,score,comment,field_values"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GradebookEntry;
}

export async function deleteGradebookEntry(input: {
  studentSchoolId: string;
  subjectId: string;
  assessmentName: string;
  assessmentDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(ENTRIES_TABLE)
    .delete()
    .eq("student_school_id", input.studentSchoolId)
    .eq("subject_id", input.subjectId)
    .eq("assessment_name", input.assessmentName)
    .eq("assessment_date", input.assessmentDate);

  if (error) {
    throw new Error(error.message);
  }
}
