import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  type ClassTimetable,
  type TimetableBlock,
  type TimetableBlockStaffAssignment,
  type TimetableBlockType,
  type TimetableBuilderData,
  type TimetableClassSummary,
  type TimetablePeriod,
  type TimetableStaffOption,
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
  type StaffDirectoryRecord,
  type StaffProfile,
  type StudentRow
} from "@/lib/types";

type ClassRecord = {
  School: string;
  Designation: string;
  "Year Group": string;
  Milepost: string;
  Level: string;
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
const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const TIMETABLE_DEFAULT_COLORS: Record<TimetableBlockType, string> = {
  lesson: "#8be6a8",
  break: "#6b7280",
  lunch: "#6b7280",
  dismissal: "#9ca3af",
  assembly: "#f59e0b",
  other: "#c4b5fd"
};

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
