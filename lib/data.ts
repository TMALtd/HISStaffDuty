import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import {
  deriveGradebookSubjectSlug,
  getGradebookSectionDefinitions,
  mergeGradebookSectionDefinitions,
  resolveGradebookSectionSlug
} from "@/lib/gradebook";
import {
  type CreateTimetableClassInput,
  type UpdateTimetableClassInput,
  type ClassTimetable,
  type TimetableBlock,
  type TimetableBlockStaffAssignment,
  type TimetableBlockType,
  type TimetableBuilderData,
  type TimetableAdminOptions,
  type TimetableClassSummary,
  type TimetablePreviewStaffOption,
  type TimetablePeriod,
  type SpecialistTimetableCoverage,
  type SpecialistTimetableDay,
  type SpecialistTimetableViewData,
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
  type GradebookAssessment,
  type GradebookTerm,
  type SpecialistRegister,
  type SpecialistRegisterStudent,
  type SpecialistTimetableSlot,
  type GradebookFieldDefinition,
  type GradebookSectionDefinition,
  type GradebookSectionSettingsInput,
  type GradebookSubject,
  type PortalHeroPageKey,
  type PortalHeroSettings,
  type FilterField,
  type FilterOptions,
  type FilterState,
  type StaffDirectoryClassOption,
  type StudentAcademicYear,
  type StudentClassAssignmentInput,
  type StudentRosterImportSummary,
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

type StudentClassAssignmentRow = {
  student_school_id: string;
  class_name: string;
  class_code: string | null;
  academic_year_label: string | null;
};

type StudentProfileOverrideRow = {
  student_school_id: string;
  academic_year_label: string | null;
  school: string | null;
  designation: string | null;
  year_group: string | null;
  milepost: string | null;
  level: string | null;
  full_name: string | null;
  surname: string | null;
  first_name: string | null;
  preferred_name: string | null;
  gender: string | null;
  nationality: string | null;
  form: string | null;
  year_code: string | null;
  tutor: string | null;
  academic_house: string | null;
};

type StudentClassMetadata = {
  class_code: string;
  class_name: string;
  school: string;
  designation: string;
  year_group: string;
  milepost: string;
  level: string;
};

type StudentAcademicYearRow = {
  id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type StudentRosterImportRow = {
  class_code: string;
  class_name: string;
  school: string;
  designation: string;
  year_group: string;
  milepost: string;
  level: string;
  school_id: string;
  full_name: string;
  surname: string | null;
  first_name: string | null;
  preferred_name: string | null;
  gender: string | null;
  form: string;
  year_code: string | null;
  tutor: string | null;
  academic_house: string | null;
  nationality: string | null;
  current_school_name: string | null;
  choice_of_programme: string | null;
  admission_status: string | null;
  offer_type: string | null;
  conditional_offer_type: string | null;
  source_filename: string | null;
};

const DEFAULT_GRADEBOOK_TERMS: GradebookTerm[] = [
  { id: "default-term-1", term_key: "term-1", term_label: "Term 1", start_date: null, end_date: null, sort_order: 1 },
  { id: "default-term-2", term_key: "term-2", term_label: "Term 2", start_date: null, end_date: null, sort_order: 2 },
  { id: "default-term-3", term_key: "term-3", term_label: "Term 3", start_date: null, end_date: null, sort_order: 3 }
];

const TABLE_NAME = "Class List";
const VIEW_NAME = "student_class_roster";
const LEGACY_STUDENT_ROSTER_VIEW_NAME = "student_class_roster_legacy";
const STUDENT_CLASS_ASSIGNMENTS_TABLE = "student_class_assignments";
const STUDENT_PROFILE_OVERRIDES_TABLE = "student_profile_overrides";
const STUDENT_ACADEMIC_YEARS_TABLE = "student_academic_years";
const STUDENT_ROSTER_ENTRIES_TABLE = "student_roster_entries";
const SUBJECTS_TABLE = "gradebook_subjects";
const FIELDS_TABLE = "gradebook_field_definitions";
const ENTRIES_TABLE = "gradebook_entries";
const ASSESSMENTS_TABLE = "gradebook_assessments";
const TERMS_TABLE = "gradebook_terms";
const SECTION_SETTINGS_TABLE = "gradebook_section_settings";
const SPECIALIST_REGISTERS_TABLE = "specialist_registers";
const SPECIALIST_REGISTER_STUDENTS_TABLE = "specialist_register_students";
const PORTAL_HERO_SETTINGS_TABLE = "portal_hero_settings";
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
const DEFAULT_PORTAL_HERO_SETTINGS: PortalHeroSettings[] = [
  {
    pageKey: "student-filter",
    label: "Student Filter",
    eyebrow: "Render-ready staff workspace",
    title: "Student filter portal",
    description:
      "Narrow the roster from school all the way down to class, then review the matching students in one place."
  },
  {
    pageKey: "markbook",
    label: "Markbook",
    eyebrow: "Markbook workspace",
    title: "Build the class markbook around real teaching sections",
    description:
      "This new workspace is organised the same way your class markbook works in practice: student profiles, parent meeting notes, and subject assessment areas such as Phonics, Reading, Writing, Maths, and IPC."
  },
  {
    pageKey: "staff-directory",
    label: "Staff Directory",
    eyebrow: "HELP Staff Workspace",
    title: "Staff Directory",
    description: "Manage staff profiles, roles, teams, and timetable access in one place."
  },
  {
    pageKey: "timetables-admin",
    label: "Timetables Admin",
    eyebrow: "Timetable administration",
    title: "Build and manage class timetables",
    description:
      "Create one weekly timetable per class, attach it to a reusable period template, and then fill each block with lessons and teachers."
  },
  {
    pageKey: "timetables-view",
    label: "Timetables View",
    eyebrow: "Timetable access",
    title: "View class timetables",
    description:
      "Open the timetable cards you have access to and review the class schedules in a cleaner read-only view."
  }
];
const DEFAULT_TIMETABLE_SUBJECT_TARGETS: TimetableSubjectTarget[] = [
  { id: "default-preschool-1-mainstream-bm", milepost: "Preschool 1", streamType: "mainstream", subjectName: "BM", requiredMinutes: 75, sortOrder: 1, isActive: true },
  { id: "default-preschool-1-mainstream-pe", milepost: "Preschool 1", streamType: "mainstream", subjectName: "P.E.", requiredMinutes: 60, sortOrder: 2, isActive: true },
  { id: "default-preschool-1-mainstream-english", milepost: "Preschool 1", streamType: "mainstream", subjectName: "English", requiredMinutes: 120, sortOrder: 3, isActive: true },
  { id: "default-preschool-1-mainstream-music", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Music", requiredMinutes: 45, sortOrder: 4, isActive: true },
  { id: "default-preschool-1-mainstream-mandarin", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Mandarin", requiredMinutes: 90, sortOrder: 5, isActive: true },
  { id: "default-preschool-1-mainstream-maths", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Maths", requiredMinutes: 210, sortOrder: 6, isActive: true },
  { id: "default-preschool-1-mainstream-assembly-pshe", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Assembly / PSHE", requiredMinutes: 30, sortOrder: 7, isActive: true },
  { id: "default-preschool-1-mainstream-phonics", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Phonics", requiredMinutes: 240, sortOrder: 8, isActive: true },
  { id: "default-preschool-1-mainstream-library", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Library", requiredMinutes: 30, sortOrder: 9, isActive: true },
  { id: "default-preschool-1-mainstream-independent-learning-time", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Independent Learning Time", requiredMinutes: 120, sortOrder: 10, isActive: true },
  { id: "default-preschool-1-mainstream-music-movement-time", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Music & Movement Time", requiredMinutes: 60, sortOrder: 11, isActive: true },
  { id: "default-preschool-1-mainstream-ieyc", milepost: "Preschool 1", streamType: "mainstream", subjectName: "IEYC", requiredMinutes: 180, sortOrder: 12, isActive: true },
  { id: "default-preschool-1-mainstream-tales-toolkit", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Tales Toolkit", requiredMinutes: 30, sortOrder: 13, isActive: true },
  { id: "default-preschool-1-mainstream-mindfulness", milepost: "Preschool 1", streamType: "mainstream", subjectName: "Mindfulness", requiredMinutes: 40, sortOrder: 14, isActive: true },
  { id: "default-preschool-2-mainstream-bm", milepost: "Preschool 2", streamType: "mainstream", subjectName: "BM", requiredMinutes: 90, sortOrder: 1, isActive: true },
  { id: "default-preschool-2-mainstream-pe", milepost: "Preschool 2", streamType: "mainstream", subjectName: "P.E.", requiredMinutes: 60, sortOrder: 2, isActive: true },
  { id: "default-preschool-2-mainstream-english", milepost: "Preschool 2", streamType: "mainstream", subjectName: "English", requiredMinutes: 120, sortOrder: 3, isActive: true },
  { id: "default-preschool-2-mainstream-music", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Music", requiredMinutes: 60, sortOrder: 4, isActive: true },
  { id: "default-preschool-2-mainstream-mandarin", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Mandarin", requiredMinutes: 90, sortOrder: 5, isActive: true },
  { id: "default-preschool-2-mainstream-maths", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Maths", requiredMinutes: 225, sortOrder: 6, isActive: true },
  { id: "default-preschool-2-mainstream-assembly-pshe", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Assembly / PSHE", requiredMinutes: 30, sortOrder: 7, isActive: true },
  { id: "default-preschool-2-mainstream-phonics", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Phonics", requiredMinutes: 240, sortOrder: 8, isActive: true },
  { id: "default-preschool-2-mainstream-library", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Library", requiredMinutes: 30, sortOrder: 9, isActive: true },
  { id: "default-preschool-2-mainstream-independent-learning-time", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Independent Learning Time", requiredMinutes: 75, sortOrder: 10, isActive: true },
  { id: "default-preschool-2-mainstream-music-movement-time", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Music & Movement Time", requiredMinutes: 90, sortOrder: 11, isActive: true },
  { id: "default-preschool-2-mainstream-ieyc", milepost: "Preschool 2", streamType: "mainstream", subjectName: "IEYC", requiredMinutes: 180, sortOrder: 12, isActive: true },
  { id: "default-preschool-2-mainstream-tales-toolkit", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Tales Toolkit", requiredMinutes: 30, sortOrder: 13, isActive: true },
  { id: "default-preschool-2-mainstream-mindfulness", milepost: "Preschool 2", streamType: "mainstream", subjectName: "Mindfulness", requiredMinutes: 40, sortOrder: 14, isActive: true },
  { id: "default-preschool-2-bilingual-bm", milepost: "Preschool 2", streamType: "bilingual", subjectName: "BM", requiredMinutes: 90, sortOrder: 1, isActive: true },
  { id: "default-preschool-2-bilingual-pe", milepost: "Preschool 2", streamType: "bilingual", subjectName: "P.E.", requiredMinutes: 60, sortOrder: 2, isActive: true },
  { id: "default-preschool-2-bilingual-english", milepost: "Preschool 2", streamType: "bilingual", subjectName: "English", requiredMinutes: 120, sortOrder: 3, isActive: true },
  { id: "default-preschool-2-bilingual-music", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Music", requiredMinutes: 30, sortOrder: 4, isActive: true },
  { id: "default-preschool-2-bilingual-mandarin", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Mandarin", requiredMinutes: 270, sortOrder: 5, isActive: true },
  { id: "default-preschool-2-bilingual-maths", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Maths", requiredMinutes: 165, sortOrder: 6, isActive: true },
  { id: "default-preschool-2-bilingual-assembly-pshe", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Assembly / PSHE", requiredMinutes: 30, sortOrder: 7, isActive: true },
  { id: "default-preschool-2-bilingual-phonics", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Phonics", requiredMinutes: 180, sortOrder: 8, isActive: true },
  { id: "default-preschool-2-bilingual-independent-learning-time", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Independent Learning Time", requiredMinutes: 75, sortOrder: 9, isActive: true },
  { id: "default-preschool-2-bilingual-music-movement-time", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Music & Movement Time", requiredMinutes: 60, sortOrder: 10, isActive: true },
  { id: "default-preschool-2-bilingual-ieyc", milepost: "Preschool 2", streamType: "bilingual", subjectName: "IEYC", requiredMinutes: 180, sortOrder: 11, isActive: true },
  { id: "default-preschool-2-bilingual-tales-toolkit", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Tales Toolkit", requiredMinutes: 30, sortOrder: 12, isActive: true },
  { id: "default-preschool-2-bilingual-mindfulness", milepost: "Preschool 2", streamType: "bilingual", subjectName: "Mindfulness", requiredMinutes: 40, sortOrder: 13, isActive: true },
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

function buildLegacyClassListPayload(params: {
  school: string;
  designation: string;
  yearGroup: string;
  milepost: string;
  level: string;
  classCode: string;
  className: string;
}) {
  return {
    School: params.school,
    Designation: params.designation,
    "Year Group": params.yearGroup,
    Milepost: params.milepost,
    Level: params.level,
    "Class Code": params.classCode,
    "Class Name": params.className
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
  const normalizeBooleanField = (value: unknown) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes";
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return false;
  };

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
    system_role: row.system_role ? String(row.system_role) : null,
    can_view_own_timetable: normalizeBooleanField(row.can_view_own_timetable),
    can_edit_own_timetable: normalizeBooleanField(row.can_edit_own_timetable),
    can_view_year_group_timetables: normalizeBooleanField(row.can_view_year_group_timetables),
    can_view_class: normalizeBooleanField(row.can_view_class),
    can_view_year_group_classes: normalizeBooleanField(row.can_view_year_group_classes),
    timetable_access_year_group: row.timetable_access_year_group
      ? String(row.timetable_access_year_group)
      : null
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
  const legacyClassListPayload = buildLegacyClassListPayload({
    school,
    designation,
    yearGroup,
    milepost,
    level,
    classCode,
    className
  });

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const result = await supabase.from(TIMETABLE_CLASSES_TABLE).insert(attempt.payload).select("*").single();

    if (result.error) {
      if (isMissingSupabaseRelationError(new Error(result.error.message), TIMETABLE_CLASSES_TABLE)) {
        const legacyInsert = await supabase.from(TABLE_NAME).insert(legacyClassListPayload).select("*").single();

        if (legacyInsert.error) {
          throw new Error(legacyInsert.error.message);
        }

        return legacyInsert.data as unknown as ClassRecord;
      }

      lastError = new Error(result.error.message);
      continue;
    }

    return normalizeCustomClassRow(result.data as Record<string, unknown>);
  }

  throw lastError ?? new Error("Could not create timetable class.");
}

export async function updateTimetableClass(input: UpdateTimetableClassInput): Promise<ClassRecord> {
  const originalClassCode = input.originalClassCode.trim();
  const originalClassName = input.originalClassName.trim();
  const className = input.className.trim();
  const yearGroup = input.yearGroup.trim();
  const school = input.school.trim() || "Primary";
  const level = input.level.trim() || "Primary";
  const streamType = normalizeTimetableStreamType(input.streamType) ?? "mainstream";
  const designation = titleCaseWords(input.designation || streamType);
  const milepost = input.milepost.trim() || inferMilepostFromYearGroup(yearGroup);
  const classCode = (input.classCode.trim() || buildSuggestedClassCode(className, yearGroup)).replace(/\s+/g, "");

  if (!originalClassCode && !originalClassName) {
    throw new Error("Original class details are required.");
  }

  if (!className || !yearGroup || !classCode) {
    throw new Error("Class name, year group, and class code are required.");
  }

  const existingClasses = await getClassRecords();
  const currentRecord =
    existingClasses.find(
      (row) =>
        normalizeTimetableLookupKey(row["Class Code"]) === normalizeTimetableLookupKey(originalClassCode) ||
        normalizeTimetableLookupKey(row["Class Name"]) === normalizeTimetableLookupKey(originalClassName)
    ) ?? null;

  if (!currentRecord) {
    throw new Error(`${originalClassName || originalClassCode} could not be found in the timetable class list.`);
  }

  const duplicate = existingClasses.find((row) => {
    const isCurrentRecord =
      normalizeTimetableLookupKey(row["Class Code"]) === normalizeTimetableLookupKey(currentRecord["Class Code"]) ||
      normalizeTimetableLookupKey(row["Class Name"]) === normalizeTimetableLookupKey(currentRecord["Class Name"]);

    if (isCurrentRecord) {
      return false;
    }

    return (
      normalizeTimetableLookupKey(row["Class Code"]) === normalizeTimetableLookupKey(classCode) ||
      normalizeTimetableLookupKey(row["Class Name"]) === normalizeTimetableLookupKey(className)
    );
  });

  if (duplicate) {
    throw new Error(`${className} already exists in the timetable class list.`);
  }

  const supabase = createSupabaseAdminClient();
  const classPayload = {
    class_code: classCode,
    class_name: className,
    school,
    designation,
    year_group: yearGroup,
    milepost,
    level,
    stream_type: streamType
  };
  const legacyClassPayload = {
    class_code: classCode,
    class_name: className,
    school,
    designation,
    year_group: yearGroup,
    milepost,
    level
  };
  const legacyClassListPayload = buildLegacyClassListPayload({
    school,
    designation,
    yearGroup,
    milepost,
    level,
    classCode,
    className
  });

  const classUpdateByCode = async (payload: Record<string, unknown>) =>
    supabase
      .from(TIMETABLE_CLASSES_TABLE)
      .update(payload)
      .eq("class_code", currentRecord["Class Code"])
      .select("*")
      .single();

  const classUpdateByName = async (payload: Record<string, unknown>) =>
    supabase
      .from(TIMETABLE_CLASSES_TABLE)
      .update(payload)
      .eq("class_name", currentRecord["Class Name"])
      .select("*")
      .single();

  const legacyClassListUpdateByCode = async () =>
    supabase
      .from(TABLE_NAME)
      .update(legacyClassListPayload)
      .eq("Class Code", currentRecord["Class Code"])
      .select("*")
      .single();

  const legacyClassListUpdateByName = async () =>
    supabase
      .from(TABLE_NAME)
      .update(legacyClassListPayload)
      .eq("Class Name", currentRecord["Class Name"])
      .select("*")
      .single();

  let updatedClassRow: Record<string, unknown> | null = null;

  const currentSchemaClassUpdate = await classUpdateByCode(classPayload);
  if (!currentSchemaClassUpdate.error) {
    updatedClassRow = currentSchemaClassUpdate.data as Record<string, unknown>;
  } else if (isMissingSupabaseRelationError(new Error(currentSchemaClassUpdate.error.message), TIMETABLE_CLASSES_TABLE)) {
    const legacyClassListUpdate = await legacyClassListUpdateByCode();
    if (!legacyClassListUpdate.error) {
      updatedClassRow = legacyClassListUpdate.data as unknown as Record<string, unknown>;
    } else {
      const legacyClassListUpdateByNameResult = await legacyClassListUpdateByName();
      if (legacyClassListUpdateByNameResult.error) {
        throw new Error(legacyClassListUpdateByNameResult.error.message);
      }

      updatedClassRow = legacyClassListUpdateByNameResult.data as unknown as Record<string, unknown>;
    }
  } else if (
    isMissingSupabaseColumnError(currentSchemaClassUpdate.error, TIMETABLE_CLASSES_TABLE, "stream_type")
  ) {
    const legacyClassUpdate = await classUpdateByCode(legacyClassPayload);
    if (!legacyClassUpdate.error) {
      updatedClassRow = legacyClassUpdate.data as Record<string, unknown>;
    } else if (isMissingSupabaseColumnError(legacyClassUpdate.error, TIMETABLE_CLASSES_TABLE, "class_code")) {
      const legacyClassUpdateByName = await classUpdateByName(legacyClassPayload);
      if (legacyClassUpdateByName.error) {
        throw new Error(legacyClassUpdateByName.error.message);
      }
      updatedClassRow = legacyClassUpdateByName.data as Record<string, unknown>;
    } else {
      throw new Error(legacyClassUpdate.error.message);
    }
  } else if (isMissingSupabaseColumnError(currentSchemaClassUpdate.error, TIMETABLE_CLASSES_TABLE, "class_code")) {
    const currentSchemaClassUpdateByName = await classUpdateByName(classPayload);
    if (!currentSchemaClassUpdateByName.error) {
      updatedClassRow = currentSchemaClassUpdateByName.data as Record<string, unknown>;
    } else if (
      isMissingSupabaseColumnError(currentSchemaClassUpdateByName.error, TIMETABLE_CLASSES_TABLE, "stream_type")
    ) {
      const legacyClassUpdateByName = await classUpdateByName(legacyClassPayload);
      if (legacyClassUpdateByName.error) {
        throw new Error(legacyClassUpdateByName.error.message);
      }
      updatedClassRow = legacyClassUpdateByName.data as Record<string, unknown>;
    } else {
      throw new Error(currentSchemaClassUpdateByName.error.message);
    }
  } else {
    throw new Error(currentSchemaClassUpdate.error.message);
  }

  if (!updatedClassRow) {
    throw new Error("Could not update timetable class.");
  }

  const timetablePayload = {
    class_code: classCode,
    class_name: className,
    stream_type: streamType
  };
  const legacyTimetablePayload = {
    class_name: className
  };

  const timetableUpdateByCode = async (payload: Record<string, unknown>) =>
    supabase.from(CLASS_TIMETABLES_TABLE).update(payload).eq("class_code", currentRecord["Class Code"]);

  const timetableUpdateByName = async (payload: Record<string, unknown>) =>
    supabase.from(CLASS_TIMETABLES_TABLE).update(payload).eq("class_name", currentRecord["Class Name"]);

  const currentSchemaTimetableUpdate = await timetableUpdateByCode(timetablePayload);
  if (currentSchemaTimetableUpdate.error) {
    if (
      isMissingSupabaseColumnError(currentSchemaTimetableUpdate.error, CLASS_TIMETABLES_TABLE, "stream_type")
    ) {
      const fallbackByCode = await timetableUpdateByCode(legacyTimetablePayload);
      if (fallbackByCode.error) {
        if (isMissingSupabaseColumnError(fallbackByCode.error, CLASS_TIMETABLES_TABLE, "class_code")) {
          const fallbackByName = await timetableUpdateByName(legacyTimetablePayload);
          if (fallbackByName.error) {
            throw new Error(fallbackByName.error.message);
          }
        } else {
          throw new Error(fallbackByCode.error.message);
        }
      }
    } else if (
      isMissingSupabaseColumnError(currentSchemaTimetableUpdate.error, CLASS_TIMETABLES_TABLE, "class_code")
    ) {
      const currentSchemaByName = await timetableUpdateByName(timetablePayload);
      if (currentSchemaByName.error) {
        if (
          isMissingSupabaseColumnError(currentSchemaByName.error, CLASS_TIMETABLES_TABLE, "stream_type")
        ) {
          const fallbackByName = await timetableUpdateByName(legacyTimetablePayload);
          if (fallbackByName.error) {
            throw new Error(fallbackByName.error.message);
          }
        } else {
          throw new Error(currentSchemaByName.error.message);
        }
      }
    } else {
      throw new Error(currentSchemaTimetableUpdate.error.message);
    }
  }

  if ("School" in updatedClassRow || "Class Code" in updatedClassRow || "Class Name" in updatedClassRow) {
    return updatedClassRow as unknown as ClassRecord;
  }

  return normalizeCustomClassRow(updatedClassRow);
}

function findClassRecordByCode(classRecords: ClassRecord[], classCode: string) {
  const normalizedCode = classCode.trim().toLowerCase();
  return classRecords.find((row) => row["Class Code"].trim().toLowerCase() === normalizedCode) ?? null;
}

function findClassRecordByName(classRecords: ClassRecord[], className: string) {
  const normalizedName = className.trim().toLowerCase();
  return classRecords.find((row) => row["Class Name"].trim().toLowerCase() === normalizedName) ?? null;
}

function normalizeStudentAcademicYearRow(row: Record<string, unknown>): StudentAcademicYearRow {
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    starts_on: row.starts_on ? String(row.starts_on) : null,
    ends_on: row.ends_on ? String(row.ends_on) : null,
    is_active: Boolean(row.is_active),
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}

function toStudentAcademicYear(
  year: StudentAcademicYearRow,
  counts?: { studentCount?: number; classCount?: number }
): StudentAcademicYear {
  return {
    ...year,
    student_count: counts?.studentCount ?? 0,
    class_count: counts?.classCount ?? 0
  };
}

async function getStudentAcademicYearRows(): Promise<StudentAcademicYearRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STUDENT_ACADEMIC_YEARS_TABLE)
    .select("id,label,starts_on,ends_on,is_active,is_archived,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), STUDENT_ACADEMIC_YEARS_TABLE)) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeStudentAcademicYearRow);
}

async function getActiveStudentAcademicYearRowOrNull(): Promise<StudentAcademicYearRow | null> {
  const years = await getStudentAcademicYearRows();
  return years.find((year) => year.is_active) ?? null;
}

async function getActiveStudentAcademicYearLabelOrNull(): Promise<string | null> {
  const activeYear = await getActiveStudentAcademicYearRowOrNull();
  return activeYear?.label ?? null;
}

function normalizeStudentRosterEntryRow(row: Record<string, unknown>): StudentRow {
  return {
    class_code: String(row.class_code ?? ""),
    class_name: String(row.class_name ?? ""),
    school: String(row.school ?? ""),
    designation: String(row.designation ?? ""),
    year_group: String(row.year_group ?? ""),
    milepost: String(row.milepost ?? ""),
    level: String(row.level ?? ""),
    school_id: String(row.school_id ?? ""),
    full_name: String(row.full_name ?? ""),
    surname: row.surname ? String(row.surname) : null,
    first_name: row.first_name ? String(row.first_name) : null,
    preferred_name: row.preferred_name ? String(row.preferred_name) : null,
    gender: row.gender ? String(row.gender) : null,
    nationality: row.nationality ? String(row.nationality) : null,
    form: String(row.form ?? ""),
    year_code: row.year_code ? String(row.year_code) : null,
    tutor: row.tutor ? String(row.tutor) : null,
    academic_house: row.academic_house ? String(row.academic_house) : null,
    assigned_teacher_name: null,
    class_assignment_source: "roster"
  };
}

async function getStudentRosterRowsFromView(academicYearLabel?: string | null): Promise<StudentRow[]> {
  const supabase = createSupabaseAdminClient();
  const rosterSelect =
    "class_code,class_name,school,designation,year_group,milepost,level,school_id,full_name,surname,first_name,preferred_name,gender,nationality,form,year_code,tutor,academic_house";
  const legacyRosterSelect =
    "class_code,class_name,school,designation,year_group,milepost,level,school_id,full_name,surname,first_name,preferred_name,gender,form,year_code,tutor,academic_house";

  if (academicYearLabel) {
    const matchingYear = (await getStudentAcademicYearRows()).find((year) => year.label === academicYearLabel) ?? null;

    if (!matchingYear) {
      return [];
    }

    const { data, error } = await supabase
      .from(STUDENT_ROSTER_ENTRIES_TABLE)
      .select(rosterSelect)
      .eq("academic_year_id", matchingYear.id)
      .order("class_name")
      .order("full_name");

    if (error) {
      if (isMissingSupabaseRelationError(new Error(error.message), STUDENT_ROSTER_ENTRIES_TABLE)) {
        throw new Error(
          "Student academic years are not set up yet. Run supabase_student_roster_academic_years.sql first."
        );
      }

      throw new Error(error.message);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeStudentRosterEntryRow);
  }

  const legacyAttempt = await supabase
    .from(VIEW_NAME)
    .select(rosterSelect)
    .order("class_name")
    .order("full_name");

  if (legacyAttempt.error) {
    if (!/nationality/i.test(legacyAttempt.error.message)) {
      throw new Error(legacyAttempt.error.message);
    }

    const fallbackAttempt = await supabase
      .from(VIEW_NAME)
      .select(legacyRosterSelect)
      .order("class_name")
      .order("full_name");

    if (fallbackAttempt.error) {
      throw new Error(fallbackAttempt.error.message);
    }

    return ((fallbackAttempt.data ?? []) as Array<Record<string, unknown>>).map((row) =>
      normalizeStudentRosterEntryRow({
        ...row,
        nationality: null
      })
    );
  }

  return ((legacyAttempt.data ?? []) as Array<Record<string, unknown>>).map(normalizeStudentRosterEntryRow);
}

export async function getFilterOptions(filters: Partial<FilterState>): Promise<FilterOptions> {
  const normalized = normalizeFilterState(filters);
  let rosterRows: StudentRow[] = [];

  try {
    rosterRows = await getStudentRosterRowsFromView();
  } catch (error) {
    if (!(error instanceof Error) || !/student_class_roster/i.test(error.message)) {
      throw error;
    }
  }

  if (rosterRows.length > 0) {
    const rosterResult = {} as FilterOptions;
    const fieldValue = (row: StudentRow, field: FilterField) => {
      switch (field) {
        case "school":
          return row.school;
        case "designation":
          return row.designation;
        case "yearGroup":
          return row.year_group;
        case "milepost":
          return row.milepost;
        case "level":
          return row.level;
        case "className":
          return row.class_name;
      }
    };

    FILTER_FIELDS.forEach((field, index) => {
      const options = Array.from(
        new Set(
          rosterRows
            .filter((row) => {
              if (index >= 1 && normalized.school && row.school !== normalized.school) {
                return false;
              }
              if (index >= 2 && normalized.designation && row.designation !== normalized.designation) {
                return false;
              }
              if (index >= 3 && normalized.yearGroup && row.year_group !== normalized.yearGroup) {
                return false;
              }
              if (index >= 4 && normalized.milepost && row.milepost !== normalized.milepost) {
                return false;
              }
              if (index >= 5 && normalized.level && row.level !== normalized.level) {
                return false;
              }

              return true;
            })
            .map((row) => fieldValue(row, field))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

      rosterResult[field] = options;
    });

    return rosterResult;
  }

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

export async function getFilterOptionsForAcademicYear(
  filters: Partial<FilterState>,
  academicYearLabel?: string | null
): Promise<FilterOptions> {
  const normalized = normalizeFilterState(filters);
  let rosterRows: StudentRow[] = [];

  try {
    rosterRows = await getStudentRosterRowsFromView(academicYearLabel);
  } catch (error) {
    if (!(error instanceof Error) || !/student_(class_roster|academic_years|roster_entries)/i.test(error.message)) {
      throw error;
    }
  }

  if (rosterRows.length > 0) {
    const rosterResult = {} as FilterOptions;
    const fieldValue = (row: StudentRow, field: FilterField) => {
      switch (field) {
        case "school":
          return row.school;
        case "designation":
          return row.designation;
        case "yearGroup":
          return row.year_group;
        case "milepost":
          return row.milepost;
        case "level":
          return row.level;
        case "className":
          return row.class_name;
      }
    };

    FILTER_FIELDS.forEach((field, index) => {
      const options = Array.from(
        new Set(
          rosterRows
            .filter((row) => {
              if (index >= 1 && normalized.school && row.school !== normalized.school) {
                return false;
              }
              if (index >= 2 && normalized.designation && row.designation !== normalized.designation) {
                return false;
              }
              if (index >= 3 && normalized.yearGroup && row.year_group !== normalized.yearGroup) {
                return false;
              }
              if (index >= 4 && normalized.milepost && row.milepost !== normalized.milepost) {
                return false;
              }
              if (index >= 5 && normalized.level && row.level !== normalized.level) {
                return false;
              }

              return true;
            })
            .map((row) => fieldValue(row, field))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

      rosterResult[field] = options;
    });

    return rosterResult;
  }

  return getFilterOptions(filters);
}

async function getStudentClassAssignmentRows(
  academicYearLabel?: string | null
): Promise<StudentClassAssignmentRow[]> {
  const supabase = createSupabaseAdminClient();
  let data: Array<Record<string, unknown>> | null = null;

  const v2Result = await supabase
    .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
    .select("student_school_id,class_name,class_code,academic_year_label");

  if (v2Result.error) {
    if (
      isMissingSupabaseRelationError(new Error(v2Result.error.message), STUDENT_CLASS_ASSIGNMENTS_TABLE)
    ) {
      return [];
    }

    if (!/academic_year_label/i.test(v2Result.error.message)) {
      throw new Error(v2Result.error.message);
    }

    const legacyResult = await supabase
      .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
      .select("student_school_id,class_name,class_code");

    if (legacyResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(legacyResult.error.message),
          STUDENT_CLASS_ASSIGNMENTS_TABLE
        )
      ) {
        return [];
      }

      throw new Error(legacyResult.error.message);
    }

    data = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
  } else {
    data = (v2Result.data ?? []) as Array<Record<string, unknown>>;
  }

  return data
    .map((row) => ({
      student_school_id: String(row.student_school_id ?? "").trim(),
      class_name: String(row.class_name ?? "").trim(),
      class_code: row.class_code ? String(row.class_code).trim() : null,
      academic_year_label: row.academic_year_label ? String(row.academic_year_label).trim() : null
    }))
    .filter((row) => {
      if (!academicYearLabel) {
        return row.academic_year_label === null;
      }

      return row.academic_year_label === academicYearLabel;
    });
}

async function getStudentProfileOverrideRows(
  academicYearLabel?: string | null
): Promise<StudentProfileOverrideRow[]> {
  const supabase = createSupabaseAdminClient();
  let data: Array<Record<string, unknown>> | null = null;

  const v2Result = await supabase
    .from(STUDENT_PROFILE_OVERRIDES_TABLE)
    .select(
      "student_school_id,academic_year_label,school,designation,year_group,milepost,level,full_name,surname,first_name,preferred_name,gender,nationality,form,year_code,tutor,academic_house"
    );

  if (v2Result.error) {
    if (isMissingSupabaseRelationError(new Error(v2Result.error.message), STUDENT_PROFILE_OVERRIDES_TABLE)) {
      return [];
    }

    if (!/academic_year_label/i.test(v2Result.error.message)) {
      throw new Error(v2Result.error.message);
    }

    const legacyResult = await supabase
      .from(STUDENT_PROFILE_OVERRIDES_TABLE)
      .select(
        "student_school_id,school,designation,year_group,milepost,level,full_name,surname,first_name,preferred_name,gender,nationality,form,year_code,tutor,academic_house"
      );

    if (legacyResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(legacyResult.error.message),
          STUDENT_PROFILE_OVERRIDES_TABLE
        )
      ) {
        return [];
      }

      throw new Error(legacyResult.error.message);
    }

    data = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
  } else {
    data = (v2Result.data ?? []) as Array<Record<string, unknown>>;
  }

  return data
    .map((row) => ({
      student_school_id: String(row.student_school_id ?? "").trim(),
      academic_year_label: row.academic_year_label ? String(row.academic_year_label).trim() || null : null,
      school: row.school ? String(row.school).trim() : null,
      designation: row.designation ? String(row.designation).trim() : null,
      year_group: row.year_group ? String(row.year_group).trim() : null,
      milepost: row.milepost ? String(row.milepost).trim() : null,
      level: row.level ? String(row.level).trim() : null,
      full_name: row.full_name ? String(row.full_name).trim() : null,
      surname: row.surname ? String(row.surname).trim() : null,
      first_name: row.first_name ? String(row.first_name).trim() : null,
      preferred_name: row.preferred_name ? String(row.preferred_name).trim() : null,
      gender: row.gender ? String(row.gender).trim() : null,
      nationality: row.nationality ? String(row.nationality).trim() : null,
      form: row.form ? String(row.form).trim() : null,
      year_code: row.year_code ? String(row.year_code).trim() : null,
      tutor: row.tutor ? String(row.tutor).trim() : null,
      academic_house: row.academic_house ? String(row.academic_house).trim() : null
    }))
    .filter((row) => {
      if (!academicYearLabel) {
        return row.academic_year_label === null;
      }

      return row.academic_year_label === academicYearLabel;
    });
}

function buildStudentClassMetadataLookup(
  classRecords: ClassRecord[],
  timetableRows: Array<Record<string, unknown> & { class_code: string | null; class_name: string }>
) {
  const byClassName = new Map<string, StudentClassMetadata>();
  const byClassCode = new Map<string, StudentClassMetadata>();

  const register = (metadata: StudentClassMetadata) => {
    buildTimetableLookupKeys(metadata.class_name).forEach((key) => byClassName.set(key, metadata));
    buildTimetableLookupKeys(metadata.class_code).forEach((key) => byClassCode.set(key, metadata));
  };

  classRecords.forEach((row) => {
    register({
      class_code: String(row["Class Code"] ?? "").trim(),
      class_name: String(row["Class Name"] ?? "").trim(),
      school: String(row.School ?? "").trim(),
      designation: String(row.Designation ?? "").trim(),
      year_group: String(row["Year Group"] ?? "").trim(),
      milepost: String(row.Milepost ?? "").trim(),
      level: String(row.Level ?? "").trim()
    });
  });

  timetableRows.forEach((row) => {
    const className = String(row.class_name ?? "").trim();
    const classCode = row.class_code ? String(row.class_code).trim() : "";
    const existing =
      buildTimetableLookupKeys(className)
        .map((key) => byClassName.get(key))
        .find(Boolean) ?? null;

    register({
      class_code: classCode || existing?.class_code || "",
      class_name: className,
      school: existing?.school || "Primary",
      designation:
        existing?.designation ||
        titleCaseWords(String(row.stream_type ?? "").trim() || "Mainstream"),
      year_group: existing?.year_group || "",
      milepost:
        existing?.milepost || inferMilepostFromYearGroup(existing?.year_group || ""),
      level: existing?.level || "Primary"
    });
  });

  return { byClassName, byClassCode };
}

async function getClassTeacherLookup(): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("name,first_name,role,class")
    .not("class", "is", null)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, Array<{ name: string; first_name: string | null; role: string | null }>>();

  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const className = String(row.class ?? "").trim();
    if (!className) {
      return;
    }

    const teacher = {
      name: String(row.name ?? "").trim(),
      first_name: row.first_name ? String(row.first_name).trim() : null,
      role: row.role ? String(row.role).trim() : null
    };

    buildTimetableLookupKeys(className).forEach((key) => {
      const current = grouped.get(key) ?? [];
      current.push(teacher);
      grouped.set(key, current);
    });
  });

  const resolved = new Map<string, string>();

  grouped.forEach((teachers, key) => {
    const ordered = [...teachers].sort((left, right) => {
      const leftRole = (left.role ?? "").toLowerCase();
      const rightRole = (right.role ?? "").toLowerCase();
      const leftScore = leftRole.includes("homeroom") ? 0 : 1;
      const rightScore = rightRole.includes("homeroom") ? 0 : 1;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.name.localeCompare(right.name, undefined, { numeric: true });
    });

    resolved.set(
      key,
      ordered
        .map((teacher) => teacher.first_name || teacher.name)
        .filter(Boolean)
        .join(" / ")
    );
  });

  return resolved;
}

export async function getStudents(
  filters: Partial<FilterState>,
  academicYearLabel?: string | null
): Promise<StudentRow[]> {
  const normalized = normalizeFilterState(filters);
  const resolvedAcademicYearLabel =
    academicYearLabel === undefined ? await getActiveStudentAcademicYearLabelOrNull() : academicYearLabel;
  const data = await getStudentRosterRowsFromView(resolvedAcademicYearLabel);

  const [assignmentRows, profileOverrideRows, classRecords, timetableRows, teacherLookup] = await Promise.all([
    getStudentClassAssignmentRows(resolvedAcademicYearLabel),
    getStudentProfileOverrideRows(resolvedAcademicYearLabel),
    getClassRecords(),
    selectClassTimetableRows(),
    getClassTeacherLookup()
  ]);

  const assignmentsByStudentId = new Map(assignmentRows.map((row) => [row.student_school_id, row]));
  const overridesByStudentId = new Map(
    profileOverrideRows.map((row) => [row.student_school_id, row])
  );
  const classMetadataLookup = buildStudentClassMetadataLookup(classRecords, timetableRows);

  return data
    .map((student) => {
      const schoolId = String(student.school_id);
      const assignment = assignmentsByStudentId.get(schoolId) ?? null;
      const assignedMetadata = assignment
        ? (assignment.class_code
            ? classMetadataLookup.byClassCode.get(normalizeTimetableLookupKey(assignment.class_code))
            : null) ??
          classMetadataLookup.byClassName.get(normalizeTimetableLookupKey(assignment.class_name)) ??
          null
        : null;

      const classCode = assignedMetadata?.class_code || assignment?.class_code || String(student.class_code ?? "");
      const className = assignedMetadata?.class_name || assignment?.class_name || String(student.class_name ?? "");
      const override = overridesByStudentId.get(schoolId) ?? null;
      const teacherName =
        buildTimetableLookupKeys(className)
          .map((key) => teacherLookup.get(key))
          .find(Boolean) ?? null;

      const nextStudent: StudentRow = {
        ...student,
        class_code: classCode,
        class_name: className,
        school: assignedMetadata?.school || String(student.school ?? ""),
        designation: assignedMetadata?.designation || String(student.designation ?? ""),
        year_group: assignedMetadata?.year_group || String(student.year_group ?? ""),
        milepost: assignedMetadata?.milepost || String(student.milepost ?? ""),
        level: assignedMetadata?.level || String(student.level ?? ""),
        school_id: schoolId,
        full_name: student.full_name ?? "",
        surname: student.surname ?? null,
        first_name: student.first_name ?? null,
        preferred_name: student.preferred_name ?? null,
        gender: student.gender ?? null,
        nationality: student.nationality ?? null,
        form: student.form ?? "",
        year_code: student.year_code ?? null,
        tutor: student.tutor ?? null,
        academic_house: student.academic_house ?? null,
        assigned_teacher_name: teacherName,
        class_assignment_source: assignment ? "override" : "roster"
      };

      if (!override) {
        return nextStudent;
      }

      return {
        ...nextStudent,
        school: override.school ?? nextStudent.school,
        designation: override.designation ?? nextStudent.designation,
        year_group: override.year_group ?? nextStudent.year_group,
        milepost: override.milepost ?? nextStudent.milepost,
        level: override.level ?? nextStudent.level,
        full_name: override.full_name ?? nextStudent.full_name,
        surname: override.surname ?? nextStudent.surname,
        first_name: override.first_name ?? nextStudent.first_name,
        preferred_name: override.preferred_name ?? nextStudent.preferred_name,
        gender: override.gender ?? nextStudent.gender,
        nationality: override.nationality ?? nextStudent.nationality,
        form: override.form ?? nextStudent.form,
        year_code: override.year_code ?? nextStudent.year_code,
        tutor: override.tutor ?? nextStudent.tutor,
        academic_house: override.academic_house ?? nextStudent.academic_house
      };
    })
    .filter((student) => {
      if (normalized.school && student.school !== normalized.school) {
        return false;
      }
      if (normalized.designation && student.designation !== normalized.designation) {
        return false;
      }
      if (normalized.yearGroup && student.year_group !== normalized.yearGroup) {
        return false;
      }
      if (normalized.milepost && student.milepost !== normalized.milepost) {
        return false;
      }
      if (normalized.level && student.level !== normalized.level) {
        return false;
      }
      if (normalized.className && student.class_name !== normalized.className) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        left.class_name.localeCompare(right.class_name, undefined, { numeric: true }) ||
        left.full_name.localeCompare(right.full_name, undefined, { numeric: true })
    );
}

export async function upsertStudentClassAssignment(
  input: StudentClassAssignmentInput,
  assignedByEmail?: string | null
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const studentSchoolId = normalizeRequiredText(input.studentSchoolId, "Student school ID");
  const className = normalizeOptionalText(input.className);
  const classCode = normalizeOptionalText(input.classCode);

  if (!className) {
    const activeAcademicYearLabel = await getActiveStudentAcademicYearLabelOrNull();
    const deleteWithYearResult = await supabase
      .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
      .delete()
      .eq("student_school_id", studentSchoolId)
      .eq("academic_year_label", activeAcademicYearLabel);

    if (deleteWithYearResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(deleteWithYearResult.error.message),
          STUDENT_CLASS_ASSIGNMENTS_TABLE
        )
      ) {
        throw new Error(
          "Student class assignments table is not set up yet. Run supabase_gradebook_student_assignments.sql first."
        );
      }

      if (!/academic_year_label/i.test(deleteWithYearResult.error.message)) {
        throw new Error(deleteWithYearResult.error.message);
      }

      const legacyDeleteResult = await supabase
        .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
        .delete()
        .eq("student_school_id", studentSchoolId);

      if (legacyDeleteResult.error) {
        if (
          isMissingSupabaseRelationError(
            new Error(legacyDeleteResult.error.message),
            STUDENT_CLASS_ASSIGNMENTS_TABLE
          )
        ) {
          throw new Error(
            "Student class assignments table is not set up yet. Run supabase_gradebook_student_assignments.sql first."
          );
        }

        throw new Error(legacyDeleteResult.error.message);
      }
    }

    return;
  }

  const activeAcademicYearLabel = await getActiveStudentAcademicYearLabelOrNull();
  const payload = {
    student_school_id: studentSchoolId,
    class_name: className,
    class_code: classCode,
    academic_year_label: activeAcademicYearLabel,
    assigned_by_email: normalizeOptionalText(assignedByEmail)?.toLowerCase() ?? null,
    updated_at: new Date().toISOString()
  };

  const v2Result = await supabase
    .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
    .upsert(payload, { onConflict: "student_school_id,academic_year_label" });

  if (v2Result.error) {
    if (isMissingSupabaseRelationError(new Error(v2Result.error.message), STUDENT_CLASS_ASSIGNMENTS_TABLE)) {
      throw new Error(
        "Student class assignments table is not set up yet. Run supabase_gradebook_student_assignments.sql first."
      );
    }

    if (!/academic_year_label/i.test(v2Result.error.message)) {
      throw new Error(v2Result.error.message);
    }

    const legacyResult = await supabase
      .from(STUDENT_CLASS_ASSIGNMENTS_TABLE)
      .upsert(
        {
          student_school_id: studentSchoolId,
          class_name: className,
          class_code: classCode,
          assigned_by_email: normalizeOptionalText(assignedByEmail)?.toLowerCase() ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "student_school_id" }
      );

    if (legacyResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(legacyResult.error.message),
          STUDENT_CLASS_ASSIGNMENTS_TABLE
        )
      ) {
        throw new Error(
          "Student class assignments table is not set up yet. Run supabase_gradebook_student_assignments.sql first."
        );
      }

      throw new Error(legacyResult.error.message);
    }
  }
}

export async function upsertStudentProfileOverride(
  input: {
    studentSchoolId: string;
    academicYearLabel?: string | null;
    school?: string | null;
    designation?: string | null;
    yearGroup?: string | null;
    milepost?: string | null;
    level?: string | null;
    fullName?: string | null;
    surname?: string | null;
    firstName?: string | null;
    preferredName?: string | null;
    gender?: string | null;
    nationality?: string | null;
    form?: string | null;
    yearCode?: string | null;
    tutor?: string | null;
    academicHouse?: string | null;
  },
  updatedByEmail?: string | null
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const studentSchoolId = normalizeRequiredText(input.studentSchoolId, "Student school ID");
  const resolvedAcademicYearLabel =
    input.academicYearLabel === undefined
      ? await getActiveStudentAcademicYearLabelOrNull()
      : input.academicYearLabel;

  const payload = {
    student_school_id: studentSchoolId,
    academic_year_label: resolvedAcademicYearLabel ?? "",
    school: normalizeOptionalText(input.school),
    designation: normalizeOptionalText(input.designation),
    year_group: normalizeOptionalText(input.yearGroup),
    milepost: normalizeOptionalText(input.milepost),
    level: normalizeOptionalText(input.level),
    full_name: normalizeOptionalText(input.fullName),
    surname: normalizeOptionalText(input.surname),
    first_name: normalizeOptionalText(input.firstName),
    preferred_name: normalizeOptionalText(input.preferredName),
    gender: normalizeOptionalText(input.gender),
    nationality: normalizeOptionalText(input.nationality),
    form: normalizeOptionalText(input.form),
    year_code: normalizeOptionalText(input.yearCode),
    tutor: normalizeOptionalText(input.tutor),
    academic_house: normalizeOptionalText(input.academicHouse),
    updated_by_email: normalizeOptionalText(updatedByEmail)?.toLowerCase() ?? null,
    updated_at: new Date().toISOString()
  };

  const v2Result = await supabase
    .from(STUDENT_PROFILE_OVERRIDES_TABLE)
    .upsert(payload, { onConflict: "student_school_id,academic_year_label" });

  if (v2Result.error) {
    if (isMissingSupabaseRelationError(new Error(v2Result.error.message), STUDENT_PROFILE_OVERRIDES_TABLE)) {
      throw new Error(
        "Student profile overrides table is not set up yet. Run supabase_student_profile_overrides.sql first."
      );
    }

    if (!/academic_year_label/i.test(v2Result.error.message)) {
      throw new Error(v2Result.error.message);
    }

    const legacyResult = await supabase
      .from(STUDENT_PROFILE_OVERRIDES_TABLE)
      .upsert(
        {
          student_school_id: studentSchoolId,
          school: payload.school,
          designation: payload.designation,
          year_group: payload.year_group,
          milepost: payload.milepost,
          level: payload.level,
          full_name: payload.full_name,
          surname: payload.surname,
          first_name: payload.first_name,
          preferred_name: payload.preferred_name,
          gender: payload.gender,
          nationality: payload.nationality,
          form: payload.form,
          year_code: payload.year_code,
          tutor: payload.tutor,
          academic_house: payload.academic_house,
          updated_by_email: payload.updated_by_email,
          updated_at: payload.updated_at
        },
        { onConflict: "student_school_id" }
      );

    if (legacyResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(legacyResult.error.message),
          STUDENT_PROFILE_OVERRIDES_TABLE
        )
      ) {
        throw new Error(
          "Student profile overrides table is not set up yet. Run supabase_student_profile_overrides.sql first."
        );
      }

      throw new Error(legacyResult.error.message);
    }
  }
}

export async function getStudentAcademicYears(): Promise<StudentAcademicYear[]> {
  const years = await getStudentAcademicYearRows();

  const countsByYearLabel = new Map<string, { studentCount: number; classCount: number }>();

  await Promise.all(
    years.map(async (year) => {
      const students = await getStudents({}, year.label);
      countsByYearLabel.set(year.label, {
        studentCount: students.length,
        classCount: new Set(
          students
            .map((student) => String(student.class_name ?? "").trim())
            .filter(Boolean)
        ).size
      });
    })
  );

  return years.map((year) =>
    toStudentAcademicYear(year, {
      studentCount: countsByYearLabel.get(year.label)?.studentCount ?? 0,
      classCount: countsByYearLabel.get(year.label)?.classCount ?? 0
    })
  );
}

export async function getStudentRosterClassOptions(
  academicYearLabel?: string | null
): Promise<StaffDirectoryClassOption[]> {
  const [baseOptions, rosterRows] = await Promise.all([
    getStaffDirectoryClassOptions(),
    (async () => {
      try {
        return await getStudentRosterRowsFromView(academicYearLabel);
      } catch (error) {
        if (
          error instanceof Error &&
          /student_(class_roster|academic_years|roster_entries)/i.test(error.message)
        ) {
          return [] as StudentRow[];
        }

        throw error;
      }
    })()
  ]);

  const uniqueOptions = new Map<string, StaffDirectoryClassOption>();

  baseOptions.forEach((option) => {
    const key = normalizeTimetableLookupKey(option.classCode || option.className);
    if (!key) {
      return;
    }

    uniqueOptions.set(key, option);
  });

  rosterRows.forEach((row) => {
    const classCode = String(row.class_code ?? "").trim();
    const className = String(row.class_name ?? "").trim();
    const key = normalizeTimetableLookupKey(classCode || className);

    if (!key) {
      return;
    }

    const existing = uniqueOptions.get(key);
    uniqueOptions.set(key, {
      classCode: classCode || existing?.classCode || "",
      className: className || existing?.className || "",
      yearGroup: String(row.year_group ?? "").trim() || existing?.yearGroup || "",
      streamType:
        normalizeTimetableStreamType(row.designation) ??
        existing?.streamType ??
        null
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

export async function upsertStudentAcademicYear(input: {
  label: string;
  startsOn?: string | null;
  endsOn?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
}): Promise<StudentAcademicYear[]> {
  const supabase = createSupabaseAdminClient();
  const label = normalizeRequiredText(input.label, "Academic year label");
  const payload = {
    label,
    starts_on: normalizeOptionalText(input.startsOn),
    ends_on: normalizeOptionalText(input.endsOn),
    is_active: Boolean(input.isActive),
    is_archived: Boolean(input.isArchived),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(STUDENT_ACADEMIC_YEARS_TABLE)
    .upsert(payload, { onConflict: "label" });

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), STUDENT_ACADEMIC_YEARS_TABLE)) {
      throw new Error(
        "Student academic years are not set up yet. Run supabase_student_roster_academic_years.sql first."
      );
    }

    throw new Error(error.message);
  }

  if (payload.is_active) {
    await setActiveStudentAcademicYear(label);
  }

  return getStudentAcademicYears();
}

export async function setActiveStudentAcademicYear(label: string): Promise<StudentAcademicYear[]> {
  const supabase = createSupabaseAdminClient();
  const normalizedLabel = normalizeRequiredText(label, "Academic year label");

  const deactivateResult = await supabase
    .from(STUDENT_ACADEMIC_YEARS_TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .neq("label", normalizedLabel);

  if (deactivateResult.error) {
    if (
      isMissingSupabaseRelationError(
        new Error(deactivateResult.error.message),
        STUDENT_ACADEMIC_YEARS_TABLE
      )
    ) {
      throw new Error(
        "Student academic years are not set up yet. Run supabase_student_roster_academic_years.sql first."
      );
    }

    throw new Error(deactivateResult.error.message);
  }

  const activateResult = await supabase
    .from(STUDENT_ACADEMIC_YEARS_TABLE)
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("label", normalizedLabel);

  if (activateResult.error) {
    throw new Error(activateResult.error.message);
  }

  return getStudentAcademicYears();
}

export async function archiveLegacyStudentRoster(input: {
  academicYearLabel: string;
  archivedByEmail?: string | null;
}): Promise<StudentAcademicYear[]> {
  const supabase = createSupabaseAdminClient();
  const academicYearLabel = normalizeRequiredText(input.academicYearLabel, "Academic year label");

  const existingYears = await getStudentAcademicYearRows();
  let targetYear = existingYears.find((year) => year.label === academicYearLabel) ?? null;

  if (!targetYear) {
    const createYearResult = await supabase
      .from(STUDENT_ACADEMIC_YEARS_TABLE)
      .insert({
        label: academicYearLabel,
        is_active: false,
        is_archived: true
      })
      .select("id,label,starts_on,ends_on,is_active,is_archived,created_at,updated_at")
      .single();

    if (createYearResult.error) {
      if (
        isMissingSupabaseRelationError(
          new Error(createYearResult.error.message),
          STUDENT_ACADEMIC_YEARS_TABLE
        )
      ) {
        throw new Error(
          "Student academic years are not set up yet. Run supabase_student_roster_academic_years.sql first."
        );
      }

      throw new Error(createYearResult.error.message);
    }

    targetYear = normalizeStudentAcademicYearRow(
      createYearResult.data as unknown as Record<string, unknown>
    );
  }

  const legacyResult = await supabase
    .from(LEGACY_STUDENT_ROSTER_VIEW_NAME)
    .select(
      "class_code,class_name,school,designation,year_group,milepost,level,school_id,full_name,preferred_name,gender,form,year_code,tutor,academic_house"
    )
    .order("class_name")
    .order("full_name");

  if (legacyResult.error) {
    if (
      isMissingSupabaseRelationError(
        new Error(legacyResult.error.message),
        LEGACY_STUDENT_ROSTER_VIEW_NAME
      )
    ) {
      throw new Error(
        "Legacy student roster view is not set up yet. Run supabase_student_roster_academic_years.sql first."
      );
    }

    throw new Error(legacyResult.error.message);
  }

  const legacyRows = (legacyResult.data ?? []) as Array<Record<string, unknown>>;

  const deleteExistingResult = await supabase
    .from(STUDENT_ROSTER_ENTRIES_TABLE)
    .delete()
    .eq("academic_year_id", targetYear.id);

  if (deleteExistingResult.error) {
    if (
      isMissingSupabaseRelationError(
        new Error(deleteExistingResult.error.message),
        STUDENT_ROSTER_ENTRIES_TABLE
      )
    ) {
      throw new Error(
        "Student roster archive table is not set up yet. Run supabase_student_roster_academic_years.sql first."
      );
    }

    throw new Error(deleteExistingResult.error.message);
  }

  if (legacyRows.length > 0) {
    const archivePayload = legacyRows.map((row) => {
      const fullName = String(row.full_name ?? "").trim();
      const preferredName = row.preferred_name ? String(row.preferred_name).trim() : null;
      const [firstNameGuess, ...surnameGuess] = fullName.split(/\s+/);
      return {
        academic_year_id: targetYear.id,
        class_code: String(row.class_code ?? "").trim(),
        class_name: String(row.class_name ?? "").trim(),
        school: String(row.school ?? "").trim(),
        designation: String(row.designation ?? "").trim(),
        year_group: String(row.year_group ?? "").trim(),
        milepost: String(row.milepost ?? "").trim(),
        level: String(row.level ?? "").trim(),
        school_id: String(row.school_id ?? "").trim(),
        full_name: fullName,
        surname: surnameGuess.length ? surnameGuess.join(" ") : null,
        first_name: firstNameGuess || null,
        preferred_name: preferredName,
        gender: row.gender ? String(row.gender).trim() : null,
        form: String(row.form ?? row.class_name ?? "").trim(),
        year_code: row.year_code ? String(row.year_code).trim() : null,
        tutor: row.tutor ? String(row.tutor).trim() : null,
        academic_house: row.academic_house ? String(row.academic_house).trim() : null,
        source_filename: "Legacy roster archive",
        imported_at: new Date().toISOString()
      };
    });

    const insertResult = await supabase.from(STUDENT_ROSTER_ENTRIES_TABLE).insert(archivePayload);

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }
  }

  const updateYearResult = await supabase
    .from(STUDENT_ACADEMIC_YEARS_TABLE)
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
      archived_by_email: normalizeOptionalText(input.archivedByEmail)?.toLowerCase() ?? null
    })
    .eq("id", targetYear.id);

  if (updateYearResult.error && !/archived_by_email/i.test(updateYearResult.error.message)) {
    throw new Error(updateYearResult.error.message);
  }

  return getStudentAcademicYears();
}

export async function importStudentRosterClassCsv(input: {
  academicYearLabel: string;
  classCode?: string | null;
  className?: string | null;
  csvText: string;
  sourceFilename?: string | null;
}): Promise<StudentRosterImportSummary> {
  const supabase = createSupabaseAdminClient();
  const academicYearLabel = normalizeRequiredText(input.academicYearLabel, "Academic year label");
  const csvText = normalizeRequiredText(input.csvText, "CSV text");
  const sourceFilename = normalizeOptionalText(input.sourceFilename);
  const classRecords = await getClassRecords();

  const targetClass =
    (input.classCode
      ? findClassRecordByCode(classRecords, input.classCode)
      : null) ??
    (input.className ? findClassRecordByName(classRecords, input.className) : null);

  if (!targetClass) {
    throw new Error("Choose a valid class before importing a student list.");
  }

  let targetYear = (await getStudentAcademicYearRows()).find((year) => year.label === academicYearLabel) ?? null;

  if (!targetYear) {
    const createdYears = await upsertStudentAcademicYear({
      label: academicYearLabel,
      isActive: false,
      isArchived: false
    });
    targetYear = createdYears.find((year) => year.label === academicYearLabel) ?? null;
  }

  if (!targetYear) {
    throw new Error("Could not create the target academic year.");
  }

  const rows = parseCsvRows(csvText);
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeClassCsvHeader(cell) === "full report name")
  );

  if (headerIndex === -1) {
    throw new Error("Could not find the student CSV header row.");
  }

  const headers = rows[headerIndex].map(normalizeClassCsvHeader);
  const dataRows = rows.slice(headerIndex + 1);
  const indexOf = (label: string) => headers.findIndex((value) => value === normalizeClassCsvHeader(label));
  const indexOfAny = (...labels: string[]) =>
    labels.reduce((foundIndex, label) => {
      if (foundIndex !== -1) {
        return foundIndex;
      }

      return indexOf(label);
    }, -1);
  const fullNameIndex = indexOf("Full Report Name");
  const firstNameIndex = indexOf("Forename");
  const preferredNameIndex = indexOf("Preferred Name");
  const surnameIndex = indexOf("Surname");
  const genderIndex = indexOf("Gender");
  const nationalityIndex = indexOf("Nationality");
  const currentSchoolIndex = indexOf("Current School Name");
  const yearCodeIndex = indexOfAny("Year Code", "Year Code On Entry");
  const schoolCodeIndex = indexOf("School Code");
  const programmeIndex = indexOf("Choice of Programme");
  const admissionStatusIndex = indexOf("Admission Status");
  const offerTypeIndex = indexOf("Offer Type");
  const conditionalOfferTypeIndex = indexOf("Conditional Offer Type");

  if (fullNameIndex === -1 || schoolCodeIndex === -1) {
    throw new Error("The CSV needs at least Full Report Name and School Code columns.");
  }

  const payload: StudentRosterImportRow[] = [];
  let skippedCount = 0;

  dataRows.forEach((row) => {
    const schoolId = String(row[schoolCodeIndex] ?? "").trim();
    const fullName = String(row[fullNameIndex] ?? "").trim();

    if (!schoolId || !fullName) {
      skippedCount += 1;
      return;
    }

    payload.push({
      class_code: String(targetClass["Class Code"] ?? "").trim(),
      class_name: String(targetClass["Class Name"] ?? "").trim(),
      school: String(targetClass.School ?? "").trim(),
      designation: String(targetClass.Designation ?? "").trim(),
      year_group: String(targetClass["Year Group"] ?? "").trim(),
      milepost: String(targetClass.Milepost ?? "").trim(),
      level: String(targetClass.Level ?? "").trim(),
      school_id: schoolId,
      full_name: fullName,
      surname: surnameIndex === -1 ? null : normalizeOptionalText(row[surnameIndex]),
      first_name: firstNameIndex === -1 ? null : normalizeOptionalText(row[firstNameIndex]),
      preferred_name: preferredNameIndex === -1 ? null : normalizeOptionalText(row[preferredNameIndex]),
      gender: genderIndex === -1 ? null : normalizeOptionalText(row[genderIndex]),
      form: String(targetClass["Class Name"] ?? "").trim(),
      year_code: yearCodeIndex === -1 ? null : normalizeOptionalText(row[yearCodeIndex]),
      tutor: null,
      academic_house: null,
      nationality: nationalityIndex === -1 ? null : normalizeOptionalText(row[nationalityIndex]),
      current_school_name: currentSchoolIndex === -1 ? null : normalizeOptionalText(row[currentSchoolIndex]),
      choice_of_programme: programmeIndex === -1 ? null : normalizeOptionalText(row[programmeIndex]),
      admission_status: admissionStatusIndex === -1 ? null : normalizeOptionalText(row[admissionStatusIndex]),
      offer_type: offerTypeIndex === -1 ? null : normalizeOptionalText(row[offerTypeIndex]),
      conditional_offer_type:
        conditionalOfferTypeIndex === -1 ? null : normalizeOptionalText(row[conditionalOfferTypeIndex]),
      source_filename: sourceFilename
    });
  });

  const deleteExistingResult = await supabase
    .from(STUDENT_ROSTER_ENTRIES_TABLE)
    .delete()
    .eq("academic_year_id", targetYear.id)
    .eq("class_name", String(targetClass["Class Name"] ?? "").trim());

  if (deleteExistingResult.error) {
    if (
      isMissingSupabaseRelationError(
        new Error(deleteExistingResult.error.message),
        STUDENT_ROSTER_ENTRIES_TABLE
      )
    ) {
      throw new Error(
        "Student roster archive table is not set up yet. Run supabase_student_roster_academic_years.sql first."
      );
    }

    throw new Error(deleteExistingResult.error.message);
  }

  if (payload.length > 0) {
    const insertPayload = payload.map((row) => ({
      academic_year_id: targetYear.id,
      ...row,
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const insertResult = await supabase.from(STUDENT_ROSTER_ENTRIES_TABLE).insert(insertPayload);
    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }
  }

  return {
    academicYearLabel,
    className: String(targetClass["Class Name"] ?? "").trim(),
    importedCount: payload.length,
    skippedCount
  };
}

export async function getStaffProfileByEmail(email: string): Promise<StaffProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("*")
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
        .select("*")
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

function applyNullableTextFilter<T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T }>(
  query: T,
  column: string,
  value: string | null | undefined
) {
  const normalized = normalizeOptionalText(value);
  return normalized === null ? query.is(column, null) : query.eq(column, normalized);
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
    system_role: normalizeOptionalText(input.system_role),
    can_view_own_timetable: Boolean(input.can_view_own_timetable),
    can_edit_own_timetable: Boolean(input.can_edit_own_timetable),
    can_view_year_group_timetables: Boolean(input.can_view_year_group_timetables),
    can_view_class: Boolean(input.can_view_class),
    can_view_year_group_classes: Boolean(input.can_view_year_group_classes),
    timetable_access_year_group: normalizeOptionalText(input.timetable_access_year_group)
  };
}

function buildLegacyStaffDirectoryPayload(input: StaffDirectoryUpsertInput) {
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

function getMissingStaffAccessMigrationMessage(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("can_edit_own_timetable")) {
    return "The staff table is missing the can_edit_own_timetable column. Run supabase_staff_timetable_edit_access.sql first.";
  }

  if (
    message.includes("can_view_class") ||
    message.includes("can_view_year_group_classes")
  ) {
    return "The staff table is missing the class access columns. Run supabase_staff_class_access.sql first.";
  }

  if (
    message.includes("can_view_own_timetable") ||
    message.includes("can_view_year_group_timetables") ||
    message.includes("timetable_access_year_group")
  ) {
    return "The staff table is missing the timetable access columns. Run supabase_staff_timetable_access.sql first.";
  }

  return null;
}

function requiresModernStaffAccessColumns(input: StaffDirectoryUpsertInput) {
  return (
    Boolean(input.can_view_own_timetable) ||
    Boolean(input.can_edit_own_timetable) ||
    Boolean(input.can_view_year_group_timetables) ||
    Boolean(input.can_view_class) ||
    Boolean(input.can_view_year_group_classes) ||
    Boolean(normalizeOptionalText(input.timetable_access_year_group))
  );
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
  const payloads = [
    {
      id,
      ...buildStaffDirectoryPayload(input),
      staff_id: nextStaffId
    },
    {
      id,
      ...buildLegacyStaffDirectoryPayload(input),
      staff_id: nextStaffId
    }
  ];

  let data: Record<string, unknown> | null = null;
  let lastError: Error | null = null;

  for (const payload of payloads) {
    const result = await supabase.from(STAFF_TABLE).insert(payload).select("*").single();

    if (result.error) {
      lastError = new Error(result.error.message);
      const migrationMessage = getMissingStaffAccessMigrationMessage(lastError);

      if (migrationMessage && requiresModernStaffAccessColumns(input)) {
        throw new Error(migrationMessage);
      }

      continue;
    }

    data = (result.data as Record<string, unknown> | null) ?? null;
    break;
  }

  if (!data) {
    throw lastError ?? new Error("Unable to create staff member.");
  }

  const profile = normalizeStaffProfile(data);

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
  const payloads = [buildStaffDirectoryPayload(input), buildLegacyStaffDirectoryPayload(input)];
  let data: Record<string, unknown> | null = null;
  let lastError: Error | null = null;

  for (const payload of payloads) {
    const result = await supabase
      .from(STAFF_TABLE)
      .update(payload)
      .eq("id", normalizedId)
      .select("*")
      .single();

    if (result.error) {
      lastError = new Error(result.error.message);
      const migrationMessage = getMissingStaffAccessMigrationMessage(lastError);

      if (migrationMessage && requiresModernStaffAccessColumns(input)) {
        throw new Error(migrationMessage);
      }

      continue;
    }

    data = (result.data as Record<string, unknown> | null) ?? null;
    break;
  }

  if (!data) {
    throw lastError ?? new Error("Unable to update staff member.");
  }

  const profile = normalizeStaffProfile(data);

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

export async function getSpecialistTimetableView(input: {
  staffProfileId: string;
  staffName?: string | null;
}): Promise<SpecialistTimetableViewData> {
  const staffProfileId = input.staffProfileId.trim();
  const emptyDays: SpecialistTimetableDay[] = WEEKDAY_ORDER.map((weekday) => ({
    key: weekday,
    label: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    slots: []
  }));

  if (!staffProfileId) {
    return {
      staffProfileId: "",
      staffName: input.staffName ?? null,
      daySchedules: emptyDays,
      slotCount: 0,
      yearGroups: []
    };
  }

  const classSummaries = (await getTimetableClassSummaries()).filter(
    (entry) => entry.hasTimetable && entry.timetableId
  );
  if (classSummaries.length === 0) {
    return {
      staffProfileId,
      staffName: input.staffName ?? null,
      daySchedules: emptyDays,
      slotCount: 0,
      yearGroups: []
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: linkRows, error: linkError } = await supabase
    .from(TIMETABLE_BLOCK_STAFF_TABLE)
    .select("block_id")
    .eq("staff_id", staffProfileId);

  if (linkError) {
    throw new Error(linkError.message);
  }

  const blockIds = Array.from(
    new Set(
      ((linkRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => String(row.block_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (blockIds.length === 0) {
    return {
      staffProfileId,
      staffName: input.staffName ?? null,
      daySchedules: emptyDays,
      slotCount: 0,
      yearGroups: []
    };
  }

  const { data: blockRows, error: blockError } = await supabase
    .from(TIMETABLE_BLOCKS_TABLE)
    .select(
      "id,class_timetable_id,period_id,title,block_type,color,notes,start_time_override,end_time_override"
    )
    .in("id", blockIds);

  if (blockError) {
    throw new Error(blockError.message);
  }

  if (!blockRows || blockRows.length === 0) {
    return {
      staffProfileId,
      staffName: input.staffName ?? null,
      daySchedules: emptyDays,
      slotCount: 0,
      yearGroups: []
    };
  }

  const periodIds = Array.from(
    new Set(
      ((blockRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => String(row.period_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (periodIds.length === 0) {
    return {
      staffProfileId,
      staffName: input.staffName ?? null,
      daySchedules: emptyDays,
      slotCount: 0,
      yearGroups: []
    };
  }

  const { data: periodRows, error: periodError } = await supabase
    .from(TIMETABLE_PERIODS_TABLE)
    .select("id,template_id,weekday,label,start_time,end_time,block_type,sort_order")
    .in("id", periodIds);

  if (periodError) {
    throw new Error(periodError.message);
  }

  const periodLookup = new Map(
    ((periodRows ?? []) as Array<Record<string, unknown>>)
      .map(normalizeTimetablePeriod)
      .map((period) => [period.id, period] as const)
  );
  const classSummaryByTimetableId = new Map(
    classSummaries
      .filter((entry) => entry.timetableId)
      .map((entry) => [entry.timetableId as string, entry] as const)
  );
  const totalClassesByYearGroup = new Map<string, Set<string>>();

  classSummaries.forEach((entry) => {
    const current = totalClassesByYearGroup.get(entry.yearGroup) ?? new Set<string>();
    current.add(entry.classCode);
    totalClassesByYearGroup.set(entry.yearGroup, current);
  });

  const slotMap = new Map<
    string,
    SpecialistTimetableSlot & {
      sortOrder: number;
      coverageMap: Map<
        string,
        {
          yearGroup: string;
          classNames: Set<string>;
          classCodes: Set<string>;
          streamTypes: Set<TimetableStreamType>;
        }
      >;
    }
  >();

  ((blockRows ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const classSummary = classSummaryByTimetableId.get(String(row.class_timetable_id ?? ""));
    const period = periodLookup.get(String(row.period_id ?? ""));

    if (!classSummary || !period) {
      return;
    }

    const blockType = normalizeTimetableBlockType(row.block_type ?? period.block_type);
    const title =
      (row.title ? String(row.title) : null) ??
      defaultTitleForTimetableType({ blockType, periodLabel: period.label }) ??
      period.label;
    const startTime = row.start_time_override ? String(row.start_time_override) : period.start_time;
    const endTime = row.end_time_override ? String(row.end_time_override) : period.end_time;
    const slotKey = [
      period.weekday,
      startTime,
      endTime,
      blockType,
      normalizeTimetableLookupKey(title)
    ].join("|");

    const existing = slotMap.get(slotKey);
    const coverageEntry =
      existing?.coverageMap.get(classSummary.yearGroup) ?? {
        yearGroup: classSummary.yearGroup,
        classNames: new Set<string>(),
        classCodes: new Set<string>(),
        streamTypes: new Set<TimetableStreamType>()
      };

    coverageEntry.classNames.add(classSummary.className);
    coverageEntry.classCodes.add(classSummary.classCode);
    if (classSummary.streamType) {
      coverageEntry.streamTypes.add(classSummary.streamType);
    }

    if (existing) {
      existing.coverageMap.set(classSummary.yearGroup, coverageEntry);
      return;
    }

    const coverageMap = new Map<string, typeof coverageEntry>();
    coverageMap.set(classSummary.yearGroup, coverageEntry);

    slotMap.set(slotKey, {
      id: String(row.id ?? slotKey),
      weekday: period.weekday,
      periodLabel: period.label,
      startTime,
      endTime,
      title,
      blockType,
      color: resolveTimetableColor(
        row.title ? String(row.title) : title,
        row.color ? String(row.color) : null,
        blockType
      ),
      notes: row.notes ? String(row.notes) : null,
      coverages: [],
      sortOrder: period.sort_order,
      coverageMap
    });
  });

  const slots = Array.from(slotMap.values())
    .map((slot) => {
      const coverages = Array.from(slot.coverageMap.values())
        .sort(
          (left, right) =>
            timetableYearGroupOrderValue(left.yearGroup) - timetableYearGroupOrderValue(right.yearGroup)
        )
        .map((coverage): SpecialistTimetableCoverage => {
          const classNames = Array.from(coverage.classNames).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
          );
          const classCodes = Array.from(coverage.classCodes).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
          );
          const streamTypes = Array.from(coverage.streamTypes).sort();
          const totalClasses = totalClassesByYearGroup.get(coverage.yearGroup)?.size ?? classCodes.length;
          const taughtClasses = classCodes.length;
          const coverageLabel =
            totalClasses <= 1 || taughtClasses >= totalClasses
              ? "100% of year group"
              : taughtClasses * 2 === totalClasses
                ? "50% of year group"
                : `${taughtClasses}/${totalClasses} classes`;

          return {
            yearGroup: coverage.yearGroup,
            classNames,
            classCodes,
            streamTypes,
            coverageLabel
          };
        });

      return {
        id: slot.id,
        weekday: slot.weekday,
        periodLabel: slot.periodLabel,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.title,
        blockType: slot.blockType,
        color: slot.color,
        notes: slot.notes,
        coverages,
        sortOrder: slot.sortOrder
      };
    })
    .sort((left, right) => {
      const daySort = weekdaySortValue(left.weekday) - weekdaySortValue(right.weekday);
      if (daySort !== 0) {
        return daySort;
      }

      if (left.startTime !== right.startTime) {
        return left.startTime.localeCompare(right.startTime);
      }

      return left.sortOrder - right.sortOrder;
    });

  const yearGroups = Array.from(
    new Set(slots.flatMap((slot) => slot.coverages.map((coverage) => coverage.yearGroup)))
  ).sort((left, right) => timetableYearGroupOrderValue(left) - timetableYearGroupOrderValue(right));

  const daySchedules = WEEKDAY_ORDER.map((weekday): SpecialistTimetableDay => ({
    key: weekday,
    label: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    slots: slots
      .filter((slot) => slot.weekday === weekday)
      .map(({ sortOrder: _sortOrder, ...slot }) => slot)
  }));

  return {
    staffProfileId,
    staffName: input.staffName ?? null,
    daySchedules,
    slotCount: slots.length,
    yearGroups
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

function normalizeSpecialistRegister(row: Record<string, unknown>): SpecialistRegister {
  return {
    id: String(row.id ?? ""),
    staff_profile_id: String(row.staff_profile_id ?? ""),
    subject_id: String(row.subject_id ?? ""),
    academic_year_label: row.academic_year_label ? String(row.academic_year_label) : null,
    year_group: String(row.year_group ?? ""),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    student_count: Number(row.student_count ?? 0) || 0,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}

function normalizeSpecialistRegisterStudent(row: Record<string, unknown>): SpecialistRegisterStudent {
  return {
    id: String(row.id ?? ""),
    register_id: String(row.register_id ?? ""),
    student_school_id: String(row.student_school_id ?? ""),
    sort_order: Number(row.sort_order ?? 0) || 0,
    created_at: row.created_at ? String(row.created_at) : null
  };
}

function specialistRegistersSetupError() {
  return "Specialist register tables are not set up yet. Run supabase_specialist_registers.sql first.";
}

export async function getSpecialistRegisters(params: {
  staffProfileId: string;
  subjectId?: string | null;
  yearGroup?: string | null;
  academicYearLabel?: string | null;
}): Promise<SpecialistRegister[]> {
  const supabase = createSupabaseAdminClient();
  const staffProfileId = normalizeRequiredText(params.staffProfileId, "Staff profile");
  const academicYearLabel =
    params.academicYearLabel === undefined
      ? await getActiveStudentAcademicYearLabelOrNull()
      : normalizeOptionalText(params.academicYearLabel);
  let query = supabase
    .from(SPECIALIST_REGISTERS_TABLE)
    .select("id,staff_profile_id,subject_id,academic_year_label,year_group,name,description,created_at,updated_at")
    .eq("staff_profile_id", staffProfileId)
    .order("year_group")
    .order("name");

  if (params.subjectId) {
    query = query.eq("subject_id", params.subjectId);
  }
  if (params.yearGroup) {
    query = query.eq("year_group", params.yearGroup);
  }
  if (academicYearLabel) {
    query = query.eq("academic_year_label", academicYearLabel);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SPECIALIST_REGISTERS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(error.message);
  }

  const registers = ((data ?? []) as Record<string, unknown>[]).map(normalizeSpecialistRegister);
  if (!registers.length) {
    return [];
  }

  const { data: studentRows, error: studentError } = await supabase
    .from(SPECIALIST_REGISTER_STUDENTS_TABLE)
    .select("register_id")
    .in(
      "register_id",
      registers.map((register) => register.id)
    );

  if (studentError) {
    if (isMissingSupabaseRelationError(new Error(studentError.message), SPECIALIST_REGISTER_STUDENTS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(studentError.message);
  }

  const counts = new Map<string, number>();
  ((studentRows ?? []) as Array<{ register_id?: string | null }>).forEach((row) => {
    const registerId = String(row.register_id ?? "");
    if (!registerId) {
      return;
    }
    counts.set(registerId, (counts.get(registerId) ?? 0) + 1);
  });

  return registers.map((register) => ({
    ...register,
    student_count: counts.get(register.id) ?? 0
  }));
}

export async function getSpecialistRegisterDetail(params: {
  registerId: string;
  staffProfileId: string;
}): Promise<{
  register: SpecialistRegister;
  students: SpecialistRegisterStudent[];
} | null> {
  const supabase = createSupabaseAdminClient();
  const registerId = normalizeRequiredText(params.registerId, "Register");
  const staffProfileId = normalizeRequiredText(params.staffProfileId, "Staff profile");
  const { data, error } = await supabase
    .from(SPECIALIST_REGISTERS_TABLE)
    .select("id,staff_profile_id,subject_id,academic_year_label,year_group,name,description,created_at,updated_at")
    .eq("id", registerId)
    .eq("staff_profile_id", staffProfileId)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SPECIALIST_REGISTERS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const { data: studentsData, error: studentsError } = await supabase
    .from(SPECIALIST_REGISTER_STUDENTS_TABLE)
    .select("id,register_id,student_school_id,sort_order,created_at")
    .eq("register_id", registerId)
    .order("sort_order")
    .order("created_at");

  if (studentsError) {
    if (isMissingSupabaseRelationError(new Error(studentsError.message), SPECIALIST_REGISTER_STUDENTS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(studentsError.message);
  }

  const students = ((studentsData ?? []) as Record<string, unknown>[]).map(normalizeSpecialistRegisterStudent);

  return {
    register: {
      ...normalizeSpecialistRegister(data as Record<string, unknown>),
      student_count: students.length
    },
    students
  };
}

const SPECIALIST_SUBJECT_SLUGS = new Set([
  "mandarin",
  "bm",
  "pe",
  "music",
  "steam-coding",
  "eal",
  "maths-support",
  "reading-support",
  "sen"
]);

export function isSpecialistGradebookSubject(subject: Pick<GradebookSubject, "slug" | "name"> | null | undefined) {
  if (!subject) {
    return false;
  }

  const slug = normalizeTimetableLookupKey(subject.slug);
  const name = normalizeTimetableLookupKey(subject.name);

  return (
    SPECIALIST_SUBJECT_SLUGS.has(slug) ||
    name === "mandarin" ||
    name === "bm" ||
    name === "p.e." ||
    name === "pe" ||
    name === "music" ||
    name.includes("steam") ||
    name.includes("coding") ||
    name === "eal" ||
    name.includes("maths support") ||
    name.includes("reading support") ||
    name === "sen"
  );
}

export async function createSpecialistRegister(input: {
  staffProfileId: string;
  subjectId: string;
  yearGroup: string;
  name: string;
  description?: string | null;
  academicYearLabel?: string | null;
  studentIds: string[];
}) {
  const supabase = createSupabaseAdminClient();
  const staffProfileId = normalizeRequiredText(input.staffProfileId, "Staff profile");
  const subjectId = normalizeRequiredText(input.subjectId, "Subject");
  const yearGroup = normalizeRequiredText(input.yearGroup, "Year group");
  const name = normalizeRequiredText(input.name, "Register name");
  const description = normalizeOptionalText(input.description);
  const academicYearLabel =
    input.academicYearLabel === undefined
      ? await getActiveStudentAcademicYearLabelOrNull()
      : normalizeOptionalText(input.academicYearLabel);
  const uniqueStudentIds = Array.from(
    new Set(input.studentIds.map((studentId) => normalizeOptionalText(studentId)).filter(Boolean) as string[])
  );

  const { data, error } = await supabase
    .from(SPECIALIST_REGISTERS_TABLE)
    .insert({
      staff_profile_id: staffProfileId,
      subject_id: subjectId,
      academic_year_label: academicYearLabel,
      year_group: yearGroup,
      name,
      description
    })
    .select("id,staff_profile_id,subject_id,academic_year_label,year_group,name,description,created_at,updated_at")
    .single();

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SPECIALIST_REGISTERS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(error.message);
  }

  const register = normalizeSpecialistRegister(data as Record<string, unknown>);

  if (uniqueStudentIds.length) {
    const { error: studentsError } = await supabase.from(SPECIALIST_REGISTER_STUDENTS_TABLE).insert(
      uniqueStudentIds.map((studentId, index) => ({
        register_id: register.id,
        student_school_id: studentId,
        sort_order: index + 1
      }))
    );

    if (studentsError) {
      if (isMissingSupabaseRelationError(new Error(studentsError.message), SPECIALIST_REGISTER_STUDENTS_TABLE)) {
        throw new Error(specialistRegistersSetupError());
      }
      throw new Error(studentsError.message);
    }
  }

  return {
    ...register,
    student_count: uniqueStudentIds.length
  };
}

export async function updateSpecialistRegister(input: {
  registerId: string;
  staffProfileId: string;
  subjectId: string;
  yearGroup: string;
  name: string;
  description?: string | null;
  academicYearLabel?: string | null;
  studentIds: string[];
}) {
  const supabase = createSupabaseAdminClient();
  const registerId = normalizeRequiredText(input.registerId, "Register");
  const staffProfileId = normalizeRequiredText(input.staffProfileId, "Staff profile");
  const subjectId = normalizeRequiredText(input.subjectId, "Subject");
  const yearGroup = normalizeRequiredText(input.yearGroup, "Year group");
  const name = normalizeRequiredText(input.name, "Register name");
  const description = normalizeOptionalText(input.description);
  const academicYearLabel =
    input.academicYearLabel === undefined
      ? await getActiveStudentAcademicYearLabelOrNull()
      : normalizeOptionalText(input.academicYearLabel);
  const uniqueStudentIds = Array.from(
    new Set(input.studentIds.map((studentId) => normalizeOptionalText(studentId)).filter(Boolean) as string[])
  );

  const { data, error } = await supabase
    .from(SPECIALIST_REGISTERS_TABLE)
    .update({
      subject_id: subjectId,
      academic_year_label: academicYearLabel,
      year_group: yearGroup,
      name,
      description
    })
    .eq("id", registerId)
    .eq("staff_profile_id", staffProfileId)
    .select("id,staff_profile_id,subject_id,academic_year_label,year_group,name,description,created_at,updated_at")
    .single();

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SPECIALIST_REGISTERS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(error.message);
  }

  const deleteResult = await supabase
    .from(SPECIALIST_REGISTER_STUDENTS_TABLE)
    .delete()
    .eq("register_id", registerId);

  if (deleteResult.error) {
    if (isMissingSupabaseRelationError(new Error(deleteResult.error.message), SPECIALIST_REGISTER_STUDENTS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(deleteResult.error.message);
  }

  if (uniqueStudentIds.length) {
    const { error: studentsError } = await supabase.from(SPECIALIST_REGISTER_STUDENTS_TABLE).insert(
      uniqueStudentIds.map((studentId, index) => ({
        register_id: registerId,
        student_school_id: studentId,
        sort_order: index + 1
      }))
    );

    if (studentsError) {
      if (isMissingSupabaseRelationError(new Error(studentsError.message), SPECIALIST_REGISTER_STUDENTS_TABLE)) {
        throw new Error(specialistRegistersSetupError());
      }
      throw new Error(studentsError.message);
    }
  }

  return {
    ...normalizeSpecialistRegister(data as Record<string, unknown>),
    student_count: uniqueStudentIds.length
  };
}

export async function deleteSpecialistRegister(params: {
  registerId: string;
  staffProfileId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const registerId = normalizeRequiredText(params.registerId, "Register");
  const staffProfileId = normalizeRequiredText(params.staffProfileId, "Staff profile");
  const { error } = await supabase
    .from(SPECIALIST_REGISTERS_TABLE)
    .delete()
    .eq("id", registerId)
    .eq("staff_profile_id", staffProfileId);

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SPECIALIST_REGISTERS_TABLE)) {
      throw new Error(specialistRegistersSetupError());
    }
    throw new Error(error.message);
  }
}

type GradebookSubjectContext = {
  className?: string;
  staffProfile?: StaffProfile | null;
  specialistSectionSlug?: string | null;
};

const SPECIALIST_STUDENT_PROFILE_ALIASES = ["Student Pastoral", "Learning Support", "PTMs"];

function buildSubjectRuleTokens(subject: GradebookSubject) {
  return buildTimetableLookupKeys(subject.name).concat(buildTimetableLookupKeys(subject.slug));
}

function subjectMatchesAliases(subject: GradebookSubject, aliases: string[]) {
  const tokens = new Set(buildSubjectRuleTokens(subject));
  return aliases.some((alias) => buildTimetableLookupKeys(alias).some((token) => tokens.has(token)));
}

function buildSpecialistRoleTokens(staffProfile: StaffProfile | null | undefined) {
  return new Set(
    [
      staffProfile?.role,
      staffProfile?.department,
      staffProfile?.designation,
      staffProfile?.class,
      staffProfile?.timetable
    ]
      .flatMap((value) => buildTimetableLookupKeys(value))
      .filter(Boolean)
  );
}

export function getMatchedSpecialistRoleAliases(staffProfile: StaffProfile | null | undefined) {
  const specialistRoleTokens = buildSpecialistRoleTokens(staffProfile);
  const specialistCategories = [
    ["mandarin"],
    ["bm", "bahasa melayu"],
    ["p.e.", "pe", "physical education"],
    ["music"],
    ["steam", "coding", "steam / coding"],
    ["eal"],
    ["maths support", "math support"],
    ["reading support", "remedial reading"],
    ["sen", "senco", "learning support"]
  ];

  return specialistCategories.filter((aliases) =>
    aliases.some((alias) => specialistRoleTokens.has(alias))
  );
}

export function isSpecialistStaffProfile(staffProfile: StaffProfile | null | undefined) {
  return getMatchedSpecialistRoleAliases(staffProfile).length > 0;
}

export function getPrimarySpecialistSectionSlug(staffProfile: StaffProfile | null | undefined) {
  const primaryAliases = getMatchedSpecialistRoleAliases(staffProfile)[0] ?? null;

  if (!primaryAliases) {
    return null;
  }

  if (primaryAliases.includes("mandarin")) {
    return "mandarin";
  }
  if (primaryAliases.includes("bm") || primaryAliases.includes("bahasa melayu")) {
    return "bm";
  }
  if (
    primaryAliases.includes("p.e.") ||
    primaryAliases.includes("pe") ||
    primaryAliases.includes("physical education")
  ) {
    return "pe";
  }
  if (primaryAliases.includes("music")) {
    return "music";
  }
  if (
    primaryAliases.includes("steam") ||
    primaryAliases.includes("coding") ||
    primaryAliases.includes("steam / coding")
  ) {
    return "steam-coding";
  }
  if (primaryAliases.includes("eal")) {
    return "eal";
  }
  if (primaryAliases.includes("maths support") || primaryAliases.includes("math support")) {
    return "maths-support";
  }
  if (primaryAliases.includes("reading support") || primaryAliases.includes("remedial reading")) {
    return "reading-support";
  }
  if (
    primaryAliases.includes("sen") ||
    primaryAliases.includes("senco") ||
    primaryAliases.includes("learning support")
  ) {
    return "sen";
  }

  return null;
}

function inferGradebookClassContext(className: string | undefined, classOptions: StaffDirectoryClassOption[]) {
  if (!className) {
    return null;
  }

  const normalizedClassName = normalizeTimetableLookupKey(className);
  const classOption =
    classOptions.find((option) => normalizeTimetableLookupKey(option.className) === normalizedClassName) ?? null;
  const yearGroup = String(classOption?.yearGroup ?? "").trim();
  const normalizedYearGroup = yearGroup.toLowerCase();
  const isPreschool =
    normalizedYearGroup.startsWith("preschool") || normalizeTimetableLookupKey(className).startsWith("preschool");
  const yearMatch = normalizedYearGroup.match(/year\s*(\d+)/);
  const yearNumber = yearMatch ? Number(yearMatch[1]) : null;

  return {
    yearGroup,
    yearNumber,
    isPreschool,
    isBilingual: classOption?.streamType === "bilingual",
    isLowerPrimary: yearNumber !== null && yearNumber >= 1 && yearNumber <= 3,
    isUpperPrimary: yearNumber !== null && yearNumber >= 4 && yearNumber <= 6,
    isMp2OrMp3: yearNumber !== null && yearNumber >= 3 && yearNumber <= 6,
    isMp3: yearNumber !== null && yearNumber >= 5 && yearNumber <= 6
  };
}

function shouldIncludeGradebookSubject(
  subject: GradebookSubject,
  classContext: ReturnType<typeof inferGradebookClassContext>,
  staffProfile: StaffProfile | null | undefined
) {
  const specialistRoleTokens = buildSpecialistRoleTokens(staffProfile);
  const isGenericSpecialist =
    specialistRoleTokens.has("specialist") ||
    specialistRoleTokens.has("support teacher") ||
    specialistRoleTokens.has("support teachers");

  const specialistCategories = [
    {
      aliases: ["Mandarin"],
      roleAliases: ["mandarin"]
    },
    {
      aliases: ["BM"],
      roleAliases: ["bm", "bahasa melayu"]
    },
    {
      aliases: ["P.E.", "PE", "Physical Education"],
      roleAliases: ["p.e.", "pe", "physical education"]
    },
    {
      aliases: ["Music"],
      roleAliases: ["music"]
    },
    {
      aliases: ["STEAM / Coding", "STEAM", "Coding"],
      roleAliases: ["steam", "coding", "steam / coding"]
    },
    {
      aliases: ["EAL"],
      roleAliases: ["eal"]
    },
    {
      aliases: ["Maths Support"],
      roleAliases: ["maths support", "math support"]
    },
    {
      aliases: ["Reading Support", "Remedial Reading"],
      roleAliases: ["reading support", "remedial reading"]
    },
    {
      aliases: ["SEN", "SENCo"],
      roleAliases: ["sen", "senco", "learning support"]
    }
  ];

  const studentProfileAliases = ["Student Pastoral", "Learning Support", "PTMs"];
  const matchedRoleCategories = specialistCategories.filter((category) =>
    category.roleAliases.some((alias) => specialistRoleTokens.has(alias))
  );
  const isMatchedSpecialistTeacher =
    matchedRoleCategories.length > 0 ||
    (isGenericSpecialist &&
      specialistCategories.some((category) =>
        category.roleAliases.some((alias) => specialistRoleTokens.has(alias))
      ));

  if (isMatchedSpecialistTeacher) {
    if (subjectMatchesAliases(subject, studentProfileAliases)) {
      return true;
    }

    return matchedRoleCategories.some((category) => subjectMatchesAliases(subject, category.aliases));
  }

  const matchedSpecialistCategory = specialistCategories.find((category) =>
    subjectMatchesAliases(subject, category.aliases)
  );

  if (matchedSpecialistCategory) {
    if (isGenericSpecialist) {
      return true;
    }

    return matchedSpecialistCategory.roleAliases.some((alias) => specialistRoleTokens.has(alias));
  }

  if (!classContext) {
    return true;
  }

  if (subjectMatchesAliases(subject, ["IEYC"])) {
    return classContext.isPreschool;
  }

  if (subjectMatchesAliases(subject, ["Phonics"])) {
    return classContext.isLowerPrimary;
  }

  if (subjectMatchesAliases(subject, ["Science"])) {
    return classContext.isUpperPrimary;
  }

  if (subjectMatchesAliases(subject, ["Spelling"])) {
    return classContext.isMp2OrMp3;
  }

  if (subjectMatchesAliases(subject, ["Design & Technology", "Design and Technology", "DT"])) {
    return classContext.isMp3;
  }

  if (
    subjectMatchesAliases(subject, [
      "Mandarin Writing",
      "Mandarin Reading",
      "Mandarin Speaking & Listening",
      "Mandarin Speaking and Listening"
    ])
  ) {
    return classContext.isBilingual;
  }

  if (subjectMatchesAliases(subject, ["Maths", "English", "Reading", "Writing", "IPC"])) {
    return true;
  }

  return true;
}

export async function getGradebookSubjects(
  context: GradebookSubjectContext = {}
): Promise<GradebookSubject[]> {
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
  const className = context.className;
  const filtered = subjects.filter((subject) =>
    className ? !subject.class_name || subject.class_name === className : !subject.class_name
  );

  if (context.staffProfile && isSpecialistStaffProfile(context.staffProfile)) {
    const resolvedSpecialistSectionSlug =
      context.specialistSectionSlug ?? getPrimarySpecialistSectionSlug(context.staffProfile);

    if (resolvedSpecialistSectionSlug) {
      const forcedSpecialistSubjects = filtered.filter(
        (subject) =>
          resolveGradebookSectionSlug(subject) === resolvedSpecialistSectionSlug ||
          subjectMatchesAliases(subject, SPECIALIST_STUDENT_PROFILE_ALIASES)
      );

      if (forcedSpecialistSubjects.length > 0) {
        return forcedSpecialistSubjects;
      }
    }

    try {
      const specialistRegisters = await getSpecialistRegisters({
        staffProfileId: context.staffProfile.id
      });
      const specialistSubjectIds = new Set(specialistRegisters.map((register) => register.subject_id));

      if (specialistSubjectIds.size > 0) {
        const specialistScopedSubjects = filtered.filter(
          (subject) =>
            specialistSubjectIds.has(subject.id) ||
            subjectMatchesAliases(subject, SPECIALIST_STUDENT_PROFILE_ALIASES)
        );

        if (specialistScopedSubjects.length > 0) {
          return specialistScopedSubjects;
        }
      }
    } catch {
      // Fall back to role-based matching if specialist register tables are unavailable.
    }
  }

  if (!className) {
    return filtered.filter((subject) => shouldIncludeGradebookSubject(subject, null, context.staffProfile));
  }

  const classSpecificSlugs = new Set(
    filtered.filter((subject) => subject.class_name === className).map((subject) => subject.slug)
  );

  const classScopedSubjects = filtered.filter(
    (subject) => subject.class_name === className || !classSpecificSlugs.has(subject.slug)
  );
  const classContext = inferGradebookClassContext(className, await getStaffDirectoryClassOptions());

  return classScopedSubjects.filter((subject) =>
    shouldIncludeGradebookSubject(subject, classContext, context.staffProfile)
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
    if (params.assessmentName && params.assessmentDate) {
      query = query
        .eq("assessment_name", params.assessmentName)
        .eq("assessment_date", params.assessmentDate);
    } else {
      query = query
        .order("assessment_date", { ascending: true })
        .order("assessment_name")
        .order("student_school_id");
    }
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

export async function getGradebookTerms(): Promise<GradebookTerm[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TERMS_TABLE)
    .select("id,term_key,term_label,start_date,end_date,sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), TERMS_TABLE)) {
      return DEFAULT_GRADEBOOK_TERMS;
    }

    throw new Error(error.message);
  }

  const terms = ((data ?? []) as GradebookTerm[]).sort((left, right) => left.sort_order - right.sort_order);
  return terms.length ? terms : DEFAULT_GRADEBOOK_TERMS;
}

export async function upsertGradebookTerms(
  input: Array<{
    termKey: string;
    termLabel: string;
    startDate: string | null;
    endDate: string | null;
    sortOrder: number;
  }>
): Promise<GradebookTerm[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TERMS_TABLE)
    .upsert(
      input.map((term) => ({
        term_key: normalizeRequiredText(term.termKey, "Term key"),
        term_label: normalizeRequiredText(term.termLabel, "Term label"),
        start_date: normalizeOptionalText(term.startDate),
        end_date: normalizeOptionalText(term.endDate),
        sort_order: term.sortOrder
      })),
      { onConflict: "term_key" }
    )
    .select("id,term_key,term_label,start_date,end_date,sort_order");

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), TERMS_TABLE)) {
      throw new Error("Gradebook terms table is not set up yet. Run supabase_gradebook_terms.sql first.");
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as GradebookTerm[]).sort((left, right) => left.sort_order - right.sort_order);
}

export async function getGradebookSectionSettings(): Promise<GradebookSectionDefinition[]> {
  const supabase = createSupabaseAdminClient();
  const defaults = getGradebookSectionDefinitions();
  const { data, error } = await supabase
    .from(SECTION_SETTINGS_TABLE)
    .select("slug,name,description,recommended_page_name,empty_state_title,empty_state_copy")
    .order("slug", { ascending: true });

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SECTION_SETTINGS_TABLE)) {
      return defaults;
    }

    throw new Error(error.message);
  }

  const overrides: GradebookSectionSettingsInput[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const slug = String(row.slug ?? "").trim();
      const defaultSection = defaults.find((section) => section.slug === slug);
      if (!defaultSection) {
        return null;
      }

      return {
        slug: defaultSection.slug,
        name: String(row.name ?? defaultSection.name),
        description: String(row.description ?? defaultSection.description),
        recommendedPageName: String(
          row.recommended_page_name ?? defaultSection.recommendedPageName
        ),
        emptyStateTitle: String(row.empty_state_title ?? defaultSection.emptyStateTitle),
        emptyStateCopy: String(row.empty_state_copy ?? defaultSection.emptyStateCopy)
      } satisfies GradebookSectionSettingsInput;
    })
    .filter((section): section is GradebookSectionSettingsInput => Boolean(section));

  return mergeGradebookSectionDefinitions(overrides);
}

export async function upsertGradebookSectionSettings(
  input: GradebookSectionSettingsInput[]
): Promise<GradebookSectionDefinition[]> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(SECTION_SETTINGS_TABLE).upsert(
    input.map((section) => ({
      slug: normalizeRequiredText(section.slug, "Section slug"),
      name: normalizeRequiredText(section.name, "Section name"),
      description: normalizeRequiredText(section.description, "Section description"),
      recommended_page_name: normalizeRequiredText(
        section.recommendedPageName,
        "Recommended page name"
      ),
      empty_state_title: normalizeRequiredText(section.emptyStateTitle, "Empty state title"),
      empty_state_copy: normalizeRequiredText(section.emptyStateCopy, "Empty state copy")
    })),
    { onConflict: "slug" }
  );

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), SECTION_SETTINGS_TABLE)) {
      throw new Error(
        "Gradebook section settings table is not set up yet. Run supabase_gradebook_section_settings.sql first."
      );
    }

    throw new Error(error.message);
  }

  return getGradebookSectionSettings();
}

export async function getPortalHeroSettings(): Promise<PortalHeroSettings[]> {
  const supabase = createSupabaseAdminClient();
  const defaults = DEFAULT_PORTAL_HERO_SETTINGS;
  const { data, error } = await supabase
    .from(PORTAL_HERO_SETTINGS_TABLE)
    .select("page_key,label,eyebrow,title,description")
    .order("page_key", { ascending: true });

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), PORTAL_HERO_SETTINGS_TABLE)) {
      return defaults;
    }

    throw new Error(error.message);
  }

  const overrideLookup = new Map(
    ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const pageKey = String(row.page_key ?? "").trim() as PortalHeroPageKey;
        const defaultSetting = defaults.find((setting) => setting.pageKey === pageKey);
        if (!defaultSetting) {
          return null;
        }

        return [
          pageKey,
          {
            pageKey,
            label: String(row.label ?? defaultSetting.label),
            eyebrow: String(row.eyebrow ?? defaultSetting.eyebrow),
            title: String(row.title ?? defaultSetting.title),
            description: String(row.description ?? defaultSetting.description)
          } satisfies PortalHeroSettings
        ] as const;
      })
      .filter((entry): entry is readonly [PortalHeroPageKey, PortalHeroSettings] => Boolean(entry))
  );

  return defaults.map((setting) => overrideLookup.get(setting.pageKey) ?? setting);
}

export async function upsertPortalHeroSettings(
  input: PortalHeroSettings[]
): Promise<PortalHeroSettings[]> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(PORTAL_HERO_SETTINGS_TABLE).upsert(
    input.map((setting) => ({
      page_key: normalizeRequiredText(setting.pageKey, "Portal page key"),
      label: normalizeRequiredText(setting.label, "Portal card label"),
      eyebrow: normalizeRequiredText(setting.eyebrow, "Portal card eyebrow"),
      title: normalizeRequiredText(setting.title, "Portal card title"),
      description: normalizeRequiredText(setting.description, "Portal card description")
    })),
    { onConflict: "page_key" }
  );

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), PORTAL_HERO_SETTINGS_TABLE)) {
      throw new Error(
        "Portal hero settings table is not set up yet. Run supabase_portal_hero_settings.sql first."
      );
    }

    throw new Error(error.message);
  }

  return getPortalHeroSettings();
}

function inferGradebookTermKey(assessmentDate: string, terms: GradebookTerm[]) {
  if (!assessmentDate) {
    return null;
  }

  const assessmentTime = Date.parse(assessmentDate);
  if (Number.isNaN(assessmentTime)) {
    return null;
  }

  const match = terms.find((term) => {
    if (!term.start_date || !term.end_date) {
      return false;
    }

    const start = Date.parse(term.start_date);
    const end = Date.parse(term.end_date);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false;
    }

    return assessmentTime >= start && assessmentTime <= end;
  });

  return match?.term_key ?? null;
}

export async function getGradebookAssessments(params: {
  subjectId: string;
  className?: string;
}): Promise<GradebookAssessment[]> {
  const supabase = createSupabaseAdminClient();
  const terms = await getGradebookTerms();
  let query = supabase
    .from(ASSESSMENTS_TABLE)
    .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,term_key,include_in_term,weighting_percent")
    .eq("subject_id", params.subjectId)
    .order("assessment_date", { ascending: false })
    .order("assessment_name");

  if (params.className) {
    query = query.eq("class_name", params.className);
  }

  let { data, error } = await query;

  if (error && isMissingSupabaseColumnError(new Error(error.message), ASSESSMENTS_TABLE, "term_key")) {
    let fallbackQuery = supabase
      .from(ASSESSMENTS_TABLE)
      .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,include_in_term,weighting_percent")
      .eq("subject_id", params.subjectId)
      .order("assessment_date", { ascending: false })
      .order("assessment_name");

    if (params.className) {
      fallbackQuery = fallbackQuery.eq("class_name", params.className);
    }

    const fallbackResult = await fallbackQuery;
    data = (fallbackResult.data ?? []).map((item) => ({
      ...item,
      term_key: inferGradebookTermKey(String(item.assessment_date ?? ""), terms)
    }));
    error = fallbackResult.error;
  }

  if (error) {
    if (!isMissingSupabaseRelationError(new Error(error.message), ASSESSMENTS_TABLE)) {
      throw new Error(error.message);
    }

    let legacyQuery = supabase
      .from(ENTRIES_TABLE)
      .select("assessment_name,assessment_date")
      .eq("subject_id", params.subjectId)
      .order("assessment_date", { ascending: false })
      .order("assessment_name");

    if (params.className) {
      legacyQuery = legacyQuery.eq("class_name", params.className);
    }

    const { data: legacyData, error: legacyError } = await legacyQuery;

    if (legacyError) {
      throw new Error(legacyError.message);
    }

    const seen = new Set<string>();
    return ((legacyData ?? []) as Array<{ assessment_name: string; assessment_date: string }>).filter(
      (item) => {
        const key = `${item.assessment_name}|${item.assessment_date}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      }
    ).map((item) => ({
      id: `legacy-${item.assessment_name}-${item.assessment_date}`,
      subject_id: params.subjectId,
      class_name: params.className ?? null,
      assessment_name: item.assessment_name,
      assessment_date: item.assessment_date,
      max_score: null,
      term_key: inferGradebookTermKey(item.assessment_date, terms),
      include_in_term: false,
      weighting_percent: null
    }));
  }

  const seen = new Set<string>();
  return ((data ?? []) as GradebookAssessment[]).filter(
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

export async function createGradebookAssessment(input: {
  subjectId: string;
  className: string | null;
  assessmentName: string;
  assessmentDate: string;
  maxScore: number | null;
  termKey?: string | null;
  includeInTerm?: boolean;
  weightingPercent?: number | null;
}): Promise<GradebookAssessment> {
  const supabase = createSupabaseAdminClient();
  let result = await supabase
    .from(ASSESSMENTS_TABLE)
    .upsert(
      {
        subject_id: input.subjectId,
        class_name: input.className,
        assessment_name: input.assessmentName,
        assessment_date: input.assessmentDate,
        max_score: input.maxScore,
        term_key: normalizeOptionalText(input.termKey),
        include_in_term: input.includeInTerm ?? false,
        weighting_percent: input.weightingPercent ?? null
      },
      {
        onConflict: "subject_id,class_name,assessment_name,assessment_date"
      }
    )
    .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,term_key,include_in_term,weighting_percent")
    .single();

  if (
    result.error &&
    isMissingSupabaseColumnError(new Error(result.error.message), ASSESSMENTS_TABLE, "term_key")
  ) {
    result = await supabase
      .from(ASSESSMENTS_TABLE)
      .upsert(
        {
          subject_id: input.subjectId,
          class_name: input.className,
          assessment_name: input.assessmentName,
          assessment_date: input.assessmentDate,
          max_score: input.maxScore,
          include_in_term: input.includeInTerm ?? false,
          weighting_percent: input.weightingPercent ?? null
        },
        {
          onConflict: "subject_id,class_name,assessment_name,assessment_date"
        }
      )
      .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,include_in_term,weighting_percent")
      .single();
  }

  const { data, error } = result;

  if (error) {
    if (isMissingSupabaseRelationError(new Error(error.message), ASSESSMENTS_TABLE)) {
      throw new Error(
        "Gradebook assessments table is not set up yet. Run supabase_gradebook_assessments.sql first."
      );
    }

    throw new Error(error.message);
  }

  return {
    ...(data as Omit<GradebookAssessment, "term_key"> & { term_key?: string | null }),
    term_key:
      "term_key" in (data as Record<string, unknown>)
        ? ((data as Record<string, unknown>).term_key as string | null)
        : inferGradebookTermKey(input.assessmentDate, await getGradebookTerms())
  } as GradebookAssessment;
}

export async function updateGradebookAssessment(input: {
  subjectId: string;
  className: string | null;
  currentAssessmentName: string;
  currentAssessmentDate: string;
  nextAssessmentName: string;
  nextAssessmentDate: string;
  maxScore: number | null;
  termKey?: string | null;
  includeInTerm?: boolean;
  weightingPercent?: number | null;
}): Promise<GradebookAssessment> {
  const supabase = createSupabaseAdminClient();
  const nextAssessmentName = normalizeRequiredText(input.nextAssessmentName, "Assessment name");
  const nextAssessmentDate = normalizeRequiredText(input.nextAssessmentDate, "Assessment date");

  let assessmentUpdate = await applyNullableTextFilter(
    supabase
      .from(ASSESSMENTS_TABLE)
      .update({
        assessment_name: nextAssessmentName,
        assessment_date: nextAssessmentDate,
        max_score: input.maxScore,
        term_key: normalizeOptionalText(input.termKey),
        include_in_term: input.includeInTerm ?? false,
        weighting_percent: input.weightingPercent ?? null
      })
      .eq("subject_id", input.subjectId)
      .eq("assessment_name", input.currentAssessmentName)
      .eq("assessment_date", input.currentAssessmentDate),
    "class_name",
    input.className
  )
    .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,term_key,include_in_term,weighting_percent")
    .single();

  if (
    assessmentUpdate.error &&
    isMissingSupabaseColumnError(new Error(assessmentUpdate.error.message), ASSESSMENTS_TABLE, "term_key")
  ) {
    assessmentUpdate = await applyNullableTextFilter(
      supabase
        .from(ASSESSMENTS_TABLE)
        .update({
          assessment_name: nextAssessmentName,
          assessment_date: nextAssessmentDate,
          max_score: input.maxScore,
          include_in_term: input.includeInTerm ?? false,
          weighting_percent: input.weightingPercent ?? null
        })
        .eq("subject_id", input.subjectId)
        .eq("assessment_name", input.currentAssessmentName)
        .eq("assessment_date", input.currentAssessmentDate),
      "class_name",
      input.className
    )
      .select("id,subject_id,class_name,assessment_name,assessment_date,max_score,include_in_term,weighting_percent")
      .single();
  }

  if (assessmentUpdate.error) {
    if (isMissingSupabaseRelationError(new Error(assessmentUpdate.error.message), ASSESSMENTS_TABLE)) {
      throw new Error(
        "Gradebook assessments table is not set up yet. Run supabase_gradebook_assessments.sql first."
      );
    }

    throw new Error(assessmentUpdate.error.message);
  }

  const entryUpdate = await applyNullableTextFilter(
    supabase
      .from(ENTRIES_TABLE)
      .update({
        assessment_name: nextAssessmentName,
        assessment_date: nextAssessmentDate
      })
      .eq("subject_id", input.subjectId)
      .eq("assessment_name", input.currentAssessmentName)
      .eq("assessment_date", input.currentAssessmentDate),
    "class_name",
    input.className
  );

  if (entryUpdate.error) {
    throw new Error(entryUpdate.error.message);
  }

  return {
    ...(assessmentUpdate.data as Omit<GradebookAssessment, "term_key"> & { term_key?: string | null }),
    term_key:
      "term_key" in (assessmentUpdate.data as Record<string, unknown>)
        ? ((assessmentUpdate.data as Record<string, unknown>).term_key as string | null)
        : inferGradebookTermKey(nextAssessmentDate, await getGradebookTerms())
  } as GradebookAssessment;
}

export async function deleteGradebookAssessment(input: {
  subjectId: string;
  className: string | null;
  assessmentName: string;
  assessmentDate: string;
}) {
  const supabase = createSupabaseAdminClient();

  const assessmentDelete = await applyNullableTextFilter(
    supabase
      .from(ASSESSMENTS_TABLE)
      .delete()
      .eq("subject_id", input.subjectId)
      .eq("assessment_name", input.assessmentName)
      .eq("assessment_date", input.assessmentDate),
    "class_name",
    input.className
  );

  if (
    assessmentDelete.error &&
    !isMissingSupabaseRelationError(new Error(assessmentDelete.error.message), ASSESSMENTS_TABLE)
  ) {
    throw new Error(assessmentDelete.error.message);
  }

  const entriesDelete = await applyNullableTextFilter(
    supabase
      .from(ENTRIES_TABLE)
      .delete()
      .eq("subject_id", input.subjectId)
      .eq("assessment_name", input.assessmentName)
      .eq("assessment_date", input.assessmentDate),
    "class_name",
    input.className
  );

  if (entriesDelete.error) {
    throw new Error(entriesDelete.error.message);
  }
}

export async function createGradebookSubject(input: {
  name: string;
  className: string | null;
  isCore?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const slug = deriveGradebookSubjectSlug(input.name);

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
