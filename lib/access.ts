import type { StaffProfile, StudentRow, TimetableClassSummary } from "@/lib/types";

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
  { href: "/", label: "Student Filter", view: "student-filter" },
  { href: "/gradebook", label: "Gradebook", view: "gradebook" },
  { href: "/duties", label: "Duty", view: "duty" },
  { href: "/duties/roster", label: "Duty Roster", view: "duty-roster" },
  { href: "/timetables", label: "Timetables", view: "timetables" },
  { href: "/directory", label: "Directory", view: "directory" },
  { href: "/admin/gradebook", label: "Setup", view: "setup" }
];

const ALL_PORTAL_VIEWS = PORTAL_NAV_ITEMS.map((item) => item.view);
const BASE_LINKED_PORTAL_VIEWS: PortalView[] = ["student-filter", "gradebook"];
const TIMETABLE_PORTAL_VIEWS: PortalView[] = ["student-filter", "gradebook", "timetables"];

export type StaffAccess = {
  isFullAccess: boolean;
  allowedViews: PortalView[];
  allowedYearGroups: string[];
  allowedClassKeys: string[];
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
      allowedYearGroups: [],
      allowedClassKeys: [],
      roleLabel: "Full access"
    };
  }
  const allowedClassKeys = staffProfile?.can_view_own_timetable
    ? [staffProfile.class, staffProfile.timetable]
        .map((value) => normalize(value))
        .filter(Boolean)
    : [];
  const allowedYearGroups = staffProfile?.can_view_year_group_timetables
    ? [staffProfile.timetable_access_year_group].map((value) => normalize(value)).filter(Boolean)
    : [];
  const hasTimetableAccess = allowedClassKeys.length > 0 || allowedYearGroups.length > 0;
  const hasLinkedProfile = Boolean(staffProfile);
  const roleParts: string[] = [];

  if (allowedClassKeys.length > 0) {
    roleParts.push("Own timetable");
  }

  if (allowedYearGroups.length > 0) {
    if (allowedYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE)) {
      roleParts.push("All timetables");
    } else {
      roleParts.push(`${staffProfile?.timetable_access_year_group ?? "Year group"} timetables`);
    }
  }

  return {
    isFullAccess: false,
    allowedViews: hasTimetableAccess
      ? [...TIMETABLE_PORTAL_VIEWS]
      : hasLinkedProfile
        ? [...BASE_LINKED_PORTAL_VIEWS]
        : [],
    allowedYearGroups,
    allowedClassKeys,
    roleLabel: roleParts.join(" + ") || (hasLinkedProfile ? "Portal access" : "No timetable access")
  };
}

export function canAccessView(access: StaffAccess, view: PortalView) {
  return access.isFullAccess || access.allowedViews.includes(view);
}

export function canAccessTimetableClass(access: StaffAccess, classSummary: TimetableClassSummary) {
  const classKeys = [classSummary.classCode, classSummary.className]
    .map((value) => normalize(value))
    .filter(Boolean);

  return (
    access.isFullAccess ||
    access.allowedYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE) ||
    access.allowedYearGroups.includes(normalize(classSummary.yearGroup)) ||
    classKeys.some((key) => access.allowedClassKeys.includes(key))
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
    access.allowedYearGroups.includes(NORMALIZED_ALL_TIMETABLES_ACCESS_VALUE) ||
    access.allowedYearGroups.includes(normalize(student.year_group)) ||
    classKeys.some((key) => access.allowedClassKeys.includes(key))
  );
}

export function filterStudentsForAccess(students: StudentRow[], access: StaffAccess) {
  if (access.isFullAccess) {
    return students;
  }

  return students.filter((student) => canAccessStudent(access, student));
}
