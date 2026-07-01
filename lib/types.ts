export const FILTER_FIELDS = [
  "school",
  "designation",
  "yearGroup",
  "milepost",
  "level",
  "className"
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

export type FilterState = {
  school: string;
  designation: string;
  yearGroup: string;
  milepost: string;
  level: string;
  className: string;
};

export type FilterOptions = Record<FilterField, string[]>;

export type StudentRow = {
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
  nationality: string | null;
  form: string;
  year_code: string | null;
  tutor: string | null;
  academic_house: string | null;
  assigned_teacher_name: string | null;
  class_assignment_source: "roster" | "override";
};

export type GradebookSubject = {
  id: string;
  name: string;
  slug: string;
  class_name: string | null;
  is_core: boolean;
};

export type GradebookFieldDefinition = {
  id: string;
  subject_id: string;
  field_key: string;
  field_label: string;
  field_type: "text" | "number" | "date" | "long_text";
  sort_order: number;
  is_required: boolean;
};

export type GradebookEntry = {
  id: string;
  student_school_id: string;
  class_name: string;
  subject_id: string;
  assessment_name: string;
  assessment_date: string;
  grade: string | null;
  score: string | null;
  comment: string | null;
  field_values: Record<string, string>;
};

export type GradebookAssessment = {
  id: string;
  subject_id: string;
  class_name: string | null;
  assessment_name: string;
  assessment_date: string;
  max_score: number | null;
  term_key: string | null;
  include_in_term: boolean;
  weighting_percent: number | null;
};

export type GradebookTerm = {
  id: string;
  term_key: string;
  term_label: string;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
};

export type GradebookSectionMode = "profile" | "assessment";

export type GradebookSectionSlug =
  | "pastoral"
  | "learning-support"
  | "ptms"
  | "phonics"
  | "reading"
  | "writing"
  | "maths"
  | "ipc";

export type GradebookSectionDefinition = {
  slug: GradebookSectionSlug;
  name: string;
  mode: GradebookSectionMode;
  description: string;
  recommendedPageName: string;
  emptyStateTitle: string;
  emptyStateCopy: string;
  fieldOrder?: string[];
};

export type GradebookSectionSettingsInput = {
  slug: GradebookSectionSlug;
  name: string;
  description: string;
  recommendedPageName: string;
  emptyStateTitle: string;
  emptyStateCopy: string;
};

export type PortalHeroPageKey =
  | "student-filter"
  | "markbook"
  | "staff-directory"
  | "timetables-admin"
  | "timetables-view";

export type PortalHeroSettings = {
  pageKey: PortalHeroPageKey;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type GradebookWorkspaceSection = GradebookSectionDefinition & {
  subject: GradebookSubject | null;
  isConfigured: boolean;
};

export type StaffProfile = {
  id: string;
  staff_id: string | null;
  name: string;
  first_name: string | null;
  role: string | null;
  email: string | null;
  department: string | null;
  class: string | null;
  extension: string | null;
  max_duties: number | null;
  status: string | null;
  unavailable_reason: string | null;
  timetable: string | null;
  photo_url: string | null;
  designation: string | null;
  system_role: string | null;
  can_view_own_timetable: boolean;
  can_edit_own_timetable: boolean;
  can_view_year_group_timetables: boolean;
  can_view_class: boolean;
  can_view_year_group_classes: boolean;
  timetable_access_year_group: string | null;
};

export type DutySummary = {
  id: string;
  name: string;
  location: string;
  dayLabel: string;
  timeLabel: string;
  category: string | null;
  color: string | null;
  assignedStaffId: string | null;
};

export type DutyDashboardData = {
  staffProfile: StaffProfile | null;
  myUpcomingDuties: DutySummary[];
  todaysSnapshot: DutySummary[];
  unassignedCount: number;
  activeDutyCount: number;
  weekdayLabel: string;
};

export type StaffDirectoryRecord = StaffProfile & {
  assigned_duties: DutySummary[];
};

export type StaffDirectoryClassOption = {
  classCode: string;
  className: string;
  yearGroup: string;
  streamType: TimetableStreamType | null;
};

export type StudentClassAssignmentInput = {
  studentSchoolId: string;
  className: string | null;
  classCode?: string | null;
};

export type StudentAcademicYear = {
  id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  is_archived: boolean;
  student_count: number;
  class_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type StudentRosterImportSummary = {
  academicYearLabel: string;
  className: string;
  importedCount: number;
  skippedCount: number;
};

export type StaffDirectoryUpsertInput = {
  id?: string;
  staff_id: string | null;
  name: string;
  first_name: string | null;
  role: string | null;
  email: string | null;
  department: string | null;
  class: string | null;
  extension: string | null;
  max_duties: number | null;
  status: string | null;
  unavailable_reason: string | null;
  timetable: string | null;
  photo_url: string | null;
  designation: string | null;
  system_role: string | null;
  can_view_own_timetable: boolean;
  can_edit_own_timetable: boolean;
  can_view_year_group_timetables: boolean;
  can_view_class: boolean;
  can_view_year_group_classes: boolean;
  timetable_access_year_group: string | null;
};

export type DutyRosterRecord = DutySummary & {
  assignedStaffName: string | null;
  assignedStaffFirstName: string | null;
  assignedStaffDepartment: string | null;
  assignedStaffPhotoUrl: string | null;
  isAssigned: boolean;
};

export type DutyRosterAssignment = DutyRosterRecord & {
  uniqueDutyId: string | null;
  dayOfWeek: string | null;
  dayOrder: number | null;
  dailyOrderNumber: number | null;
};

export type DutyRosterStaffOption = {
  id: string;
  label: string;
  firstName: string | null;
  department: string | null;
};

export type DutyRosterSubGroup = {
  id: string;
  name: string;
  location: string;
  dutyOrder: number | null;
  color: string | null;
  assignments: DutyRosterAssignment[];
};

export type DutyRosterGroup = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  timeLabel: string;
  daysLabel: string;
  color: string | null;
  subGroups: DutyRosterSubGroup[];
};

export type DutyRosterViewData = {
  groups: DutyRosterGroup[];
  dutyGroupOptions: Array<{ id: string; label: string }>;
  staffOptions: DutyRosterStaffOption[];
  departmentOptions: string[];
};

export type TimetableBlockType =
  | "lesson"
  | "break"
  | "lunch"
  | "dismissal"
  | "assembly"
  | "other";

export type TimetableTemplate = {
  id: string;
  name: string;
  school: string | null;
  designation: string | null;
  year_group: string | null;
  is_active: boolean;
};

export type TimetableStreamType = "mainstream" | "bilingual";

export type TimetablePeriod = {
  id: string;
  template_id: string;
  weekday: string;
  label: string;
  start_time: string;
  end_time: string;
  block_type: TimetableBlockType;
  sort_order: number;
};

export type ClassTimetable = {
  id: string;
  class_code: string | null;
  class_name: string;
  template_id: string;
  template_name: string;
  stream_type: TimetableStreamType | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TimetableBlockStaffAssignment = {
  staff_id: string;
  staff_name: string;
  staff_first_name: string | null;
  department: string | null;
  photo_url: string | null;
};

export type TimetableBlock = {
  id: string;
  class_timetable_id: string;
  period_id: string;
  weekday: string;
  period_label: string;
  start_time: string;
  end_time: string;
  block_type: TimetableBlockType;
  title: string | null;
  color: string | null;
  notes: string | null;
  start_time_override: string | null;
  end_time_override: string | null;
  sort_order: number;
  teachers: TimetableBlockStaffAssignment[];
};

export type TimetableStaffOption = {
  id: string;
  label: string;
  firstName: string | null;
  department: string | null;
  photoUrl: string | null;
};

export type TimetableClassSummary = {
  classCode: string;
  className: string;
  school: string;
  designation: string;
  yearGroup: string;
  milepost: string;
  level: string;
  streamType: TimetableStreamType | null;
  hasTimetable: boolean;
  timetableId: string | null;
  templateId: string | null;
  templateName: string | null;
};

export type CreateTimetableClassInput = {
  classCode: string;
  className: string;
  school: string;
  designation: string;
  yearGroup: string;
  milepost: string;
  level: string;
  streamType: TimetableStreamType;
};

export type UpdateTimetableClassInput = {
  originalClassCode: string;
  originalClassName: string;
  classCode: string;
  className: string;
  school: string;
  designation: string;
  yearGroup: string;
  milepost: string;
  level: string;
  streamType: TimetableStreamType;
};

export type TimetableSubjectTarget = {
  id: string;
  milepost: string;
  streamType: TimetableStreamType;
  subjectName: string;
  requiredMinutes: number;
  sortOrder: number;
  isActive: boolean;
};

export type TimetableAdminOptions = {
  schools: string[];
  yearGroups: string[];
  mileposts: string[];
  levels: string[];
};

export type TimetablePreviewStaffOption = {
  email: string;
  name: string;
};

export type TimetableBuilderData = {
  classSummary: TimetableClassSummary;
  templates: TimetableTemplate[];
  timetable: ClassTimetable | null;
  periods: TimetablePeriod[];
  blocks: TimetableBlock[];
  staffOptions: TimetableStaffOption[];
  subjectTargets: TimetableSubjectTarget[];
};

export const EMPTY_FILTERS: FilterState = {
  school: "",
  designation: "",
  yearGroup: "",
  milepost: "",
  level: "",
  className: ""
};

export function toQueryFilters(searchParams: URLSearchParams): FilterState {
  return {
    school: searchParams.get("school") ?? "",
    designation: searchParams.get("designation") ?? "",
    yearGroup: searchParams.get("yearGroup") ?? "",
    milepost: searchParams.get("milepost") ?? "",
    level: searchParams.get("level") ?? "",
    className: searchParams.get("className") ?? ""
  };
}
