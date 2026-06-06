import type { StaffProfile, TimetableClassSummary } from "@/lib/types";

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

const FULL_ACCESS_EMAILS = new Set([
  "benjamin.allen@kl.his.edu.my",
  "daniel.goldspink@kl.his.edu.my"
]);

const FULL_ACCESS_NAMES = new Set(["benjamin allen", "daniel goldspink"]);

const HOY_YEAR_GROUPS = new Map<string, string>([
  ["natalie cook", "Year 1"],
  ["laura munro", "Year 2"],
  ["vannesa louis", "Year 3"],
  ["vanessa louis", "Year 3"],
  ["diana dennis", "Year 4"],
  ["santiara van rijswijk", "Year 5"],
  ["braden cobb", "Year 6"]
]);

export type StaffAccess = {
  isFullAccess: boolean;
  allowedViews: PortalView[];
  allowedYearGroups: string[] | null;
  roleLabel: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getStaffAccess(staffProfile: StaffProfile | null, email?: string | null): StaffAccess {
  const normalizedEmail = normalize(email ?? staffProfile?.email);
  const normalizedName = normalize(staffProfile?.name);
  const normalizedSystemRole = normalize(staffProfile?.system_role);
  const isFullAccess =
    normalizedSystemRole === "admin" ||
    normalizedSystemRole === "administrator" ||
    FULL_ACCESS_EMAILS.has(normalizedEmail) ||
    FULL_ACCESS_NAMES.has(normalizedName);

  if (isFullAccess) {
    return {
      isFullAccess: true,
      allowedViews: [...ALL_PORTAL_VIEWS],
      allowedYearGroups: null,
      roleLabel: "Full access"
    };
  }

  const hoyYearGroup = HOY_YEAR_GROUPS.get(normalizedName);

  return {
    isFullAccess: false,
    allowedViews: ["timetables"],
    allowedYearGroups: hoyYearGroup ? [hoyYearGroup] : null,
    roleLabel: hoyYearGroup ? `HoY ${hoyYearGroup}` : "Timetables only"
  };
}

export function canAccessView(access: StaffAccess, view: PortalView) {
  return access.isFullAccess || access.allowedViews.includes(view);
}

export function canAccessTimetableClass(access: StaffAccess, classSummary: TimetableClassSummary) {
  return (
    access.isFullAccess ||
    access.allowedYearGroups === null ||
    access.allowedYearGroups.includes(classSummary.yearGroup)
  );
}

export function filterTimetableClassesForAccess(
  classes: TimetableClassSummary[],
  access: StaffAccess
) {
  return classes.filter((classSummary) => canAccessTimetableClass(access, classSummary));
}
