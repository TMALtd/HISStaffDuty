import type {
  PortalPageAccessKey,
  PortalPageAccessSetting,
  StaffProfile,
  StudentRow,
  TimetableClassSummary
} from "@/lib/types";

export const ALL_TIMETABLES_ACCESS_VALUE = "All Timetables";
const NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE = normalize(ALL_TIMETABLES_ACCESS_VALUE);

export type PortalView =
  | "student-filter"
  | "gradebook"
  | "duty"
  | "duty-roster"
  | "timetables"
  | "directory"
  | "setup";

export const PORTAL_NAV_ITEMS: Array<{
  href: string;
  label: string;
  view: PortalView;
}> = [
  { href: "/", label: "Students", view: "student-filter" },
  { href: "/gradebook", label: "Markbook", view: "gradebook" },
  { href: "/duties", label: "Duties", view: "duty" },
  { href: "/duties/roster", label: "Duty Roster", view: "duty-roster" },
  { href: "/timetables", label: "Timetables", view: "timetables" },
  { href: "/directory", label: "Staff Directory", view: "directory" },
  { href: "/admin/gradebook", label: "Setup", view: "setup" }
];

export const MANAGED_PORTAL_PAGE_ITEMS: Array<{
  pageKey: PortalPageAccessKey;
  label: string;
}> = [
  { pageKey: "student-filter", label: "Students" },
  { pageKey: "duty", label: "Duties" },
  { pageKey: "gradebook", label: "Markbooks" },
  { pageKey: "timetables", label: "Timetables" },
  { pageKey: "directory", label: "Staff Directory" }
];

const ALL_PORTAL_VIEWS = PORTAL_NAV_ITEMS.map((item) => item.view);
const BASE_LINKED_PORTAL_VIEWS: PortalView[] = ["student-filter", "gradebook", "directory"];
const TIMETABLE_PORTAL_VIEWS: PortalView[] = ["student-filter", "gradebook", "timetables", "directory"];

export type StaffAccess = {
  isFullAccess: boolean;
  allowedViews: PortalView[];
  allowedTimetableYearGroups: string[];
  allowedTimetableClassKeys: string[];
  canEditOwnTimetable: boolean;
  allowedStudentYearGroups: string[];
  allowedStudentClassKeys: string[];
  roleLabel: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getStaffAccess(staffProfile: StaffProfile | null): StaffAccess {
  const normalizedSystemRole = normalize(staffProfile?.system_role);
  const isFullAccess =
    normalizedSystemRole === "admin" ||
    normalizedSystemRole === "administrator";

  if (isFullAccess) {
    return {
      isFullAccess: true,
      allowedViews: [...ALL_PORTAL_VIEWS],
      allowedTimetableYearGroups: [],
      allowedTimetableClassKeys: [],
      canEditOwnTimetable: true,
      allowedStudentYearGroups: [],
      allowedStudentClassKeys: [],
      roleLabel: "Full access"
    };
  }
  const allowedTimetableClassKeys = staffProfile?.can_view_own_timetable
    ? [staffProfile.class, staffProfile.timetable]
        .map((value) => normalize(value))
        .filter(Boolean)
    : [];
  const allowedTimetableYearGroups = staffProfile?.can_view_year_group_timetables
    ? [staffProfile.timetable_access_year_group].map((value) => normalize(value)).filter(Boolean)
    : [];
  const hasTimetableAccess =
    allowedTimetableClassKeys.length > 0 || allowedTimetableYearGroups.length > 0;
  const canEditOwnTimetable =
    Boolean(staffProfile?.can_edit_own_timetable) && allowedTimetableClassKeys.length > 0;
  const ownClassKeys = [staffProfile?.class, staffProfile?.timetable]
    .map((value) => normalize(value))
    .filter(Boolean);
  const usesDedicatedStudentAccess =
    Boolean(staffProfile?.can_view_class) || Boolean(staffProfile?.can_view_year_group_classes);
  const allowedStudentClassKeys = usesDedicatedStudentAccess
    ? staffProfile?.can_view_class
      ? ownClassKeys
      : []
    : ownClassKeys.length > 0
      ? [...ownClassKeys]
      : [...allowedTimetableClassKeys];
  const allowedStudentYearGroups = usesDedicatedStudentAccess
    ? staffProfile?.can_view_year_group_classes
      ? [staffProfile.timetable_access_year_group].map((value) => normalize(value)).filter(Boolean)
      : []
    : [...allowedTimetableYearGroups];
  const hasStudentAccess =
    allowedStudentClassKeys.length > 0 || allowedStudentYearGroups.length > 0;
  const hasLinkedProfile = Boolean(staffProfile);
  const roleParts: string[] = [];

  if (allowedTimetableClassKeys.length > 0) {
    roleParts.push("Own timetable");
  }

  if (canEditOwnTimetable) {
    roleParts.push("Own timetable editing");
  }

  if (allowedTimetableYearGroups.length > 0) {
    if (allowedTimetableYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE)) {
      roleParts.push("All timetables");
    } else {
      roleParts.push(`${staffProfile?.timetable_access_year_group ?? "Year group"} timetables`);
    }
  }

  if (usesDedicatedStudentAccess || (!hasTimetableAccess && hasStudentAccess)) {
    if (allowedStudentClassKeys.length > 0) {
      roleParts.push("Class view");
    }

    if (allowedStudentYearGroups.length > 0) {
      if (allowedStudentYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE)) {
        roleParts.push("All classes");
      } else {
        roleParts.push(`${staffProfile?.timetable_access_year_group ?? "Year group"} classes`);
      }
    }
  }

  return {
    isFullAccess: false,
    allowedViews: hasTimetableAccess
      ? [...TIMETABLE_PORTAL_VIEWS]
      : hasStudentAccess || hasLinkedProfile
        ? [...BASE_LINKED_PORTAL_VIEWS]
        : [],
    allowedTimetableYearGroups,
    allowedTimetableClassKeys,
    canEditOwnTimetable,
    allowedStudentYearGroups,
    allowedStudentClassKeys,
    roleLabel: roleParts.join(" + ") || (hasLinkedProfile ? "Portal access" : "No timetable access")
  };
}

export function canAccessView(access: StaffAccess, view: PortalView) {
  return access.isFullAccess || access.allowedViews.includes(view);
}

export function getPortalPageAccessKeyForView(view: PortalView): PortalPageAccessKey | null {
  switch (view) {
    case "student-filter":
      return "student-filter";
    case "gradebook":
      return "gradebook";
    case "duty":
    case "duty-roster":
      return "duty";
    case "timetables":
      return "timetables";
    case "directory":
      return "directory";
    case "setup":
      return null;
    default:
      return null;
  }
}

export function isPortalViewGloballyEnabled(
  view: PortalView,
  settings: PortalPageAccessSetting[]
) {
  const pageKey = getPortalPageAccessKeyForView(view);

  if (!pageKey) {
    return true;
  }

  return settings.find((setting) => setting.pageKey === pageKey)?.isEnabled ?? true;
}

export function filterPortalViewsForAvailability(
  views: PortalView[],
  settings: PortalPageAccessSetting[],
  bypassDisabled = false
) {
  if (bypassDisabled) {
    return views;
  }

  return views.filter((view) => isPortalViewGloballyEnabled(view, settings));
}

export function canAccessTimetableClass(access: StaffAccess, classSummary: TimetableClassSummary) {
  const classKeys = [classSummary.classCode, classSummary.className]
    .map((value) => normalize(value))
    .filter(Boolean);

  return (
    access.isFullAccess ||
    access.allowedTimetableYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE) ||
    access.allowedTimetableYearGroups.includes(normalize(classSummary.yearGroup)) ||
    classKeys.some((key) => access.allowedTimetableClassKeys.includes(key))
  );
}

export function canEditTimetableClass(access: StaffAccess, classSummary: TimetableClassSummary) {
  const classKeys = [classSummary.classCode, classSummary.className]
    .map((value) => normalize(value))
    .filter(Boolean);

  return (
    access.isFullAccess ||
    (access.canEditOwnTimetable &&
      classKeys.some((key) => access.allowedTimetableClassKeys.includes(key)))
  );
}

export function filterTimetableClassesForAccess(
  classes: TimetableClassSummary[],
  access: StaffAccess
) {
  return classes.filter((classSummary) => canAccessTimetableClass(access, classSummary));
}

export function canAccessStudent(access: StaffAccess, student: Pick<StudentRow, "class_code" | "class_name" | "year_group">) {
  const classKeys = [student.class_code, student.class_name]
    .map((value) => normalize(value))
    .filter(Boolean);

  return (
    access.isFullAccess ||
    access.allowedStudentYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE) ||
    access.allowedStudentYearGroups.includes(normalize(student.year_group)) ||
    classKeys.some((key) => access.allowedStudentClassKeys.includes(key))
  );
}

export function filterStudentsForAccess(students: StudentRow[], access: StaffAccess) {
  if (access.isFullAccess) {
    return students;
  }

  return students.filter((student) => canAccessStudent(access, student));
}
