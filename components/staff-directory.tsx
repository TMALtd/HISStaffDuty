"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ImgHTMLAttributes
} from "react";
import { useRouter } from "next/navigation";
import { ALL_TIMETABLES_ACCESS_VALUE } from "@/lib/access";
import type {
  PortalHeroSettings,
  StaffChangeLogEntry,
  StaffDirectoryClassOption,
  StaffDirectoryRecord,
  StaffDirectoryUpsertInput
} from "@/lib/types";

type StaffDirectoryProps = {
  staff: StaffDirectoryRecord[];
  classOptions: StaffDirectoryClassOption[];
  showAdminGuidance?: boolean;
  canManageStaff?: boolean;
  heroSettings?: PortalHeroSettings | null;
};

type ModalMode = "view" | "edit" | "create";

type StaffTeamKey =
  | "slt"
  | "preschool"
  | "mp1"
  | "mp2"
  | "mp3"
  | "specialist"
  | "support";

type StaffTeamSection = {
  key: StaffTeamKey;
  title: string;
  subGroups: Array<{
    key: string;
    title: string;
    staff: StaffDirectoryRecord[];
  }>;
};

type StaffHistoryResponse = {
  history?: StaffChangeLogEntry[];
  error?: string;
};

const EMPTY_FORM: StaffDirectoryUpsertInput = {
  staff_id: "",
  name: "",
  first_name: "",
  role: "",
  email: "",
  department: "",
  team: "",
  sub_team: "",
  year_group_label: "",
  milepost_label: "",
  class: "",
  extension: "",
  max_duties: null,
  status: "",
  unavailable_reason: "",
  timetable: "",
  photo_url: "",
  designation: "",
  system_role: "",
  can_view_own_timetable: false,
  can_edit_own_timetable: false,
  can_view_year_group_timetables: false,
  can_view_class: false,
  can_view_year_group_classes: false,
  timetable_access_year_group: ""
};

function uniqueValues(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.map((item) => (item ?? "").trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
}

function formatDutyLabel(duty: StaffDirectoryRecord["assigned_duties"][number]) {
  return `${duty.dayLabel} / ${duty.name} (${duty.timeLabel})`;
}

type StaffExportRow = {
  staffId: string;
  name: string;
  firstName: string;
  role: string;
  email: string;
  department: string;
  team: string;
  subTeam: string;
  yearGroupLabel: string;
  milepostLabel: string;
  designation: string;
  assignedClass: string;
  timetableLabel: string;
  yearGroupAccess: string;
  extension: string;
  status: string;
  maxDuties: string;
  duties: string;
};

function buildStaffExportRows(staff: StaffDirectoryRecord[]): StaffExportRow[] {
  return staff.map((person) => ({
    staffId: person.staff_id ?? "",
    name: person.name,
    firstName: person.first_name ?? "",
    role: person.role ?? "",
    email: person.email ?? "",
    department: person.department ?? "",
    team: person.team ?? "",
    subTeam: person.sub_team ?? "",
    yearGroupLabel: person.year_group_label ?? "",
    milepostLabel: person.milepost_label ?? "",
    designation: person.designation ?? "",
    assignedClass: person.class ?? "",
    timetableLabel: person.timetable ?? "",
    yearGroupAccess: person.timetable_access_year_group ?? "",
    extension: person.extension ?? "",
    status: person.status ?? "",
    maxDuties:
      person.max_duties === null || person.max_duties === undefined ? "" : String(person.max_duties),
    duties: person.assigned_duties.map((duty) => formatDutyLabel(duty)).join(" | ")
  }));
}

function csvEscape(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toFormValues(record: StaffDirectoryRecord): StaffDirectoryUpsertInput {
  return {
    id: record.id,
    staff_id: record.staff_id ?? "",
    name: record.name,
    first_name: record.first_name ?? "",
    role: record.role ?? "",
    email: record.email ?? "",
    department: record.department ?? "",
    team: record.team ?? "",
    sub_team: record.sub_team ?? "",
    year_group_label: record.year_group_label ?? "",
    milepost_label: record.milepost_label ?? "",
    class: record.class ?? "",
    extension: record.extension ?? "",
    max_duties: record.max_duties,
    status: record.status ?? "",
    unavailable_reason: record.unavailable_reason ?? "",
    timetable: record.timetable ?? "",
    photo_url: record.photo_url ?? "",
    designation: record.designation ?? "",
    system_role: record.system_role ?? "",
    can_view_own_timetable: record.can_view_own_timetable,
    can_edit_own_timetable: record.can_edit_own_timetable,
    can_view_year_group_timetables: record.can_view_year_group_timetables,
    can_view_class: record.can_view_class,
    can_view_year_group_classes: record.can_view_year_group_classes,
    timetable_access_year_group: record.timetable_access_year_group ?? ""
  };
}

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function combinedStaffText(person: StaffDirectoryRecord) {
  return [
    person.name,
    person.first_name,
    person.role,
    person.department,
    person.team,
    person.sub_team,
    person.year_group_label,
    person.milepost_label,
    person.designation,
    person.class,
    person.timetable
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function matchesWholeTerm(value: string, pattern: RegExp) {
  return pattern.test(value);
}

function resolveExplicitYearGroup(person: StaffDirectoryRecord) {
  const storedYearGroup = person.year_group_label?.trim();
  if (storedYearGroup) {
    return storedYearGroup;
  }

  const accessYearGroup = person.timetable_access_year_group?.trim();
  if (
    accessYearGroup &&
    accessYearGroup !== ALL_TIMETABLES_ACCESS_VALUE &&
    /^(preschool\s+\d+|year\s+\d+)$/i.test(accessYearGroup)
  ) {
    return accessYearGroup;
  }

  const values = [person.timetable_access_year_group]
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);

  for (const value of values) {
    if (matchesWholeTerm(value, /\bpreschool 1\b/)) {
      return "Preschool 1";
    }
    if (matchesWholeTerm(value, /\bpreschool 2\b/)) {
      return "Preschool 2";
    }
    if (matchesWholeTerm(value, /\byear 1\b/)) {
      return "Year 1";
    }
    if (matchesWholeTerm(value, /\byear 2\b/)) {
      return "Year 2";
    }
    if (matchesWholeTerm(value, /\byear 3\b/)) {
      return "Year 3";
    }
    if (matchesWholeTerm(value, /\byear 4\b/)) {
      return "Year 4";
    }
    if (matchesWholeTerm(value, /\byear 5\b/)) {
      return "Year 5";
    }
    if (matchesWholeTerm(value, /\byear 6\b/)) {
      return "Year 6";
    }
  }

  return null;
}

function resolvePreferredYearGroup(
  person: StaffDirectoryRecord,
  classYearGroupLookup: Map<string, string>
) {
  return (
    resolveExplicitYearGroup(person) ??
    resolveStaffAssignedYearGroup(person, classYearGroupLookup)
  );
}

function resolveExplicitMilepost(person: StaffDirectoryRecord) {
  const storedMilepost = person.milepost_label?.trim();
  if (storedMilepost) {
    const normalizedStoredMilepost = storedMilepost.toLowerCase();

    if (normalizedStoredMilepost === "mp1" || normalizedStoredMilepost === "milepost 1") {
      return "mp1";
    }
    if (normalizedStoredMilepost === "mp2" || normalizedStoredMilepost === "milepost 2") {
      return "mp2";
    }
    if (normalizedStoredMilepost === "mp3" || normalizedStoredMilepost === "milepost 3") {
      return "mp3";
    }
  }

  return null;
}

function buildClassYearGroupLookup(options: StaffDirectoryClassOption[]) {
  const lookup = new Map<string, string>();

  for (const option of options) {
    const normalizedName = normalizeLookupValue(option.className);
    const normalizedCode = normalizeLookupValue(option.classCode);

    if (normalizedName) {
      lookup.set(normalizedName, option.yearGroup);
    }

    if (normalizedCode) {
      lookup.set(normalizedCode, option.yearGroup);
    }
  }

  return lookup;
}

function resolveStaffAssignedYearGroup(
  person: StaffDirectoryRecord,
  classYearGroupLookup: Map<string, string>
) {
  const lookupCandidates = [person.class, person.timetable]
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);

  for (const candidate of lookupCandidates) {
    const matchedYearGroup = classYearGroupLookup.get(candidate);
    if (matchedYearGroup) {
      return matchedYearGroup;
    }
  }

  return null;
}

function getStaffTeamKey(
  person: StaffDirectoryRecord,
  classYearGroupLookup: Map<string, string>
): StaffTeamKey {
  const text = combinedStaffText(person);
  const resolvedYearGroup = resolvePreferredYearGroup(person, classYearGroupLookup);
  const explicitMilepost = resolveExplicitMilepost(person);
  const storedTeam = normalizeLookupValue(person.team);

  if (storedTeam === "slt" || storedTeam === "senior leadership team") {
    return "slt";
  }

  if (storedTeam === "preschool") {
    return "preschool";
  }

  if (storedTeam === "mp1" || storedTeam === "milepost 1") {
    return "mp1";
  }

  if (storedTeam === "mp2" || storedTeam === "milepost 2") {
    return "mp2";
  }

  if (storedTeam === "mp3" || storedTeam === "milepost 3") {
    return "mp3";
  }

  if (storedTeam === "specialist" || storedTeam === "specialist teams") {
    return "specialist";
  }

  if (storedTeam === "support" || storedTeam === "support teams") {
    return "support";
  }

  if (
    includesAny(text, [
      "principal",
      "assistant principal",
      "vice principal",
      "deputy",
      "head of primary",
      "head of school",
      "headteacher",
      "slt",
      "senior leadership"
    ])
  ) {
    return "slt";
  }

  if (resolvedYearGroup === "Preschool 1" || resolvedYearGroup === "Preschool 2") {
    return "preschool";
  }

  if (resolvedYearGroup === "Year 1" || resolvedYearGroup === "Year 2") {
    return "mp1";
  }

  if (resolvedYearGroup === "Year 3" || resolvedYearGroup === "Year 4") {
    return "mp2";
  }

  if (resolvedYearGroup === "Year 5" || resolvedYearGroup === "Year 6") {
    return "mp3";
  }

  if (explicitMilepost) {
    return explicitMilepost;
  }

  if (text.includes("preschool")) {
    return "preschool";
  }

  if (includesAny(text, ["year 1", "year 2", "mp1"])) {
    return "mp1";
  }

  if (includesAny(text, ["year 3", "year 4", "mp2"])) {
    return "mp2";
  }

  if (includesAny(text, ["year 5", "year 6", "mp3"])) {
    return "mp3";
  }

  if (
    includesAny(text, [
      "music",
      "mandarin",
      "bm",
      "bahasa",
      "p.e.",
      "pe ",
      " pe",
      "physical education",
      "library",
      "coding",
      "specialist"
    ])
  ) {
    return "specialist";
  }

  return "support";
}

function getStaffSubGroupTitle(
  person: StaffDirectoryRecord,
  teamKey: StaffTeamKey,
  classYearGroupLookup: Map<string, string>
) {
  const storedSubTeam = person.sub_team?.trim();
  if (storedSubTeam) {
    return storedSubTeam;
  }

  const text = combinedStaffText(person);
  const assignedYearGroup = resolvePreferredYearGroup(person, classYearGroupLookup);

  if (teamKey === "slt") {
    return "Senior Leadership Team";
  }

  if (teamKey === "preschool") {
    if (assignedYearGroup === "Preschool 1") {
      return "Preschool 1";
    }
    if (assignedYearGroup === "Preschool 2") {
      return "Preschool 2";
    }
    return "Preschool Support Teachers";
  }

  if (teamKey === "mp1") {
    if (assignedYearGroup === "Year 1") {
      return "Year 1";
    }
    if (assignedYearGroup === "Year 2") {
      return "Year 2";
    }
    return "Support Teachers";
  }

  if (teamKey === "mp2") {
    if (assignedYearGroup === "Year 3") {
      return "Year 3";
    }
    if (assignedYearGroup === "Year 4") {
      return "Year 4";
    }
    return "Support Teachers";
  }

  if (teamKey === "mp3") {
    if (assignedYearGroup === "Year 5") {
      return "Year 5";
    }
    if (assignedYearGroup === "Year 6") {
      return "Year 6";
    }
    return "Support Teachers";
  }

  if (teamKey === "specialist") {
    if (includesAny(text, ["music & movement", "music and movement", "music"])) {
      return "Music";
    }
    if (includesAny(text, ["mandarin"])) {
      return "Mandarin";
    }
    if (includesAny(text, ["bm", "bahasa"])) {
      return "BM";
    }
    if (includesAny(text, ["p.e.", "physical education", " pe ", "pe "])) {
      return "P.E.";
    }
    if (includesAny(text, ["library"])) {
      return "Library";
    }
    if (includesAny(text, ["coding", "computer science"])) {
      return "Coding";
    }
    if (includesAny(text, ["steam"])) {
      return "STEAM";
    }
    if (includesAny(text, ["counselling", "counseling", "counsellor", "counselor"])) {
      return "Counselling";
    }
    if (includesAny(text, ["maths support", "math support"])) {
      return "Maths Support";
    }
    if (includesAny(text, ["remedial reading", "reading support"])) {
      return "Remedial Reading";
    }
    if (includesAny(text, ["eal", "english as an additional language"])) {
      return "EAL";
    }
    if (includesAny(text, ["senco"])) {
      return "SENCo";
    }
    if (includesAny(text, ["sen", "special educational needs"])) {
      return "SEN";
    }
    if (includesAny(text, ["administration", "admin"])) {
      return "Administration";
    }
    return "General Specialist";
  }

  if (includesAny(text, ["counselling", "counseling", "counsellor", "counselor"])) {
    return "Counselling";
  }
  if (includesAny(text, ["maths support", "math support"])) {
    return "Maths Support";
  }
  if (includesAny(text, ["remedial reading", "reading support"])) {
    return "Remedial Reading";
  }
  if (includesAny(text, ["eal", "english as an additional language"])) {
    return "EAL";
  }
  if (includesAny(text, ["senco"])) {
    return "SENCo";
  }
  if (includesAny(text, ["sen", "special educational needs"])) {
    return "SEN";
  }
  if (includesAny(text, ["steam"])) {
    return "STEAM";
  }
  if (includesAny(text, ["administration", "admin"])) {
    return "Administration";
  }
  if (includesAny(text, ["music"])) {
    return "Music";
  }
  if (includesAny(text, ["mandarin"])) {
    return "Mandarin";
  }
  if (includesAny(text, ["bm", "bahasa"])) {
    return "BM";
  }
  if (includesAny(text, ["p.e.", "physical education", " pe ", "pe "])) {
    return "P.E.";
  }
  if (includesAny(text, ["library"])) {
    return "Library";
  }
  if (includesAny(text, ["coding", "computer science"])) {
    return "Coding";
  }

  return "General Support";
}

function getStaffFilterTeamLabel(
  person: StaffDirectoryRecord,
  classYearGroupLookup: Map<string, string>
) {
  const teamKey = getStaffTeamKey(person, classYearGroupLookup);

  if (teamKey === "slt") {
    return "SLT";
  }

  return getStaffSubGroupTitle(person, teamKey, classYearGroupLookup);
}

function compareStaff(left: StaffDirectoryRecord, right: StaffDirectoryRecord) {
  const leftId = Number(left.staff_id ?? Number.NaN);
  const rightId = Number(right.staff_id ?? Number.NaN);

  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
    return leftId - rightId;
  }

  return left.name.localeCompare(right.name, undefined, { numeric: true });
}

function buildStaffTeamSections(
  staff: StaffDirectoryRecord[],
  classYearGroupLookup: Map<string, string>
): StaffTeamSection[] {
  const teamDefinitions: Array<{
    key: StaffTeamKey;
    title: string;
    subgroupOrder: string[];
  }> = [
    { key: "slt", title: "SLT", subgroupOrder: ["Senior Leadership Team"] },
    {
      key: "preschool",
      title: "Preschool",
      subgroupOrder: ["Preschool 1", "Preschool 2", "Preschool Support Teachers"]
    },
    { key: "mp1", title: "MP1", subgroupOrder: ["Year 1", "Year 2", "Support Teachers"] },
    { key: "mp2", title: "MP2", subgroupOrder: ["Year 3", "Year 4", "Support Teachers"] },
    { key: "mp3", title: "MP3", subgroupOrder: ["Year 5", "Year 6", "Support Teachers"] },
    {
      key: "specialist",
      title: "Specialist Teams",
      subgroupOrder: [
        "Music",
        "Mandarin",
        "BM",
        "P.E.",
        "Library",
        "Coding",
        "STEAM",
        "Maths Support",
        "Remedial Reading",
        "EAL",
        "SENCo",
        "SEN",
        "Counselling",
        "Administration",
        "General Specialist"
      ]
    },
    {
      key: "support",
      title: "Support Teams",
      subgroupOrder: [
        "Administration",
        "Counselling",
        "Maths Support",
        "Remedial Reading",
        "EAL",
        "SENCo",
        "SEN",
        "STEAM",
        "Music",
        "Mandarin",
        "BM",
        "P.E.",
        "Library",
        "Coding",
        "General Support"
      ]
    }
  ];

  return teamDefinitions
    .map((teamDefinition) => {
      const staffInTeam = staff.filter(
        (person) => getStaffTeamKey(person, classYearGroupLookup) === teamDefinition.key
      );
      const grouped = new Map<string, StaffDirectoryRecord[]>();

      for (const person of staffInTeam) {
        const subGroupTitle = getStaffSubGroupTitle(
          person,
          teamDefinition.key,
          classYearGroupLookup
        );
        const existing = grouped.get(subGroupTitle) ?? [];
        existing.push(person);
        grouped.set(subGroupTitle, existing);
      }

      const orderedTitles = [
        ...teamDefinition.subgroupOrder,
        ...Array.from(grouped.keys()).filter((title) => !teamDefinition.subgroupOrder.includes(title)).sort()
      ];

      const subGroups = orderedTitles
        .map((title) => {
          const subGroupStaff = grouped.get(title) ?? [];
          if (!subGroupStaff.length) {
            return null;
          }

          return {
            key: `${teamDefinition.key}-${title}`,
            title,
            staff: [...subGroupStaff].sort(compareStaff)
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

      return {
        key: teamDefinition.key,
        title: teamDefinition.title,
        subGroups
      };
    })
    .filter((team) => team.subGroups.length > 0);
}
function buildKnownClassLookup(options: StaffDirectoryClassOption[]) {
  const lookup = new Set<string>();

  for (const option of options) {
    const normalizedName = normalizeLookupValue(option.className);
    const normalizedCode = normalizeLookupValue(option.classCode);

    if (normalizedName) {
      lookup.add(normalizedName);
    }

    if (normalizedCode) {
      lookup.add(normalizedCode);
    }
  }

  return lookup;
}

function getStaffCardAccentLine(
  person: StaffDirectoryRecord,
  knownClassLookup: Set<string>
) {
  const normalizedClass = normalizeLookupValue(person.class);

  if (normalizedClass && knownClassLookup.has(normalizedClass)) {
    return person.class ?? "Staff profile";
  }

  if (person.class?.trim()) {
    return person.class;
  }

  if (person.year_group_label?.trim()) {
    return person.year_group_label;
  }

  if (person.milepost_label?.trim()) {
    return person.milepost_label;
  }

  if (person.sub_team?.trim()) {
    return person.sub_team;
  }

  if (person.designation?.trim()) {
    return person.designation;
  }

  if (person.timetable?.trim()) {
    return person.timetable;
  }

  if (person.class?.trim()) {
    return person.class;
  }

  return "Staff profile";
}

function isDistinctPlacementValue(
  value: string | null | undefined,
  ...others: Array<string | null | undefined>
) {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) {
    return false;
  }

  return others.every((other) => normalizeLookupValue(other) !== normalizedValue);
}

function classOptionLabel(option: StaffDirectoryClassOption) {
  const stream = option.streamType
    ? option.streamType.charAt(0).toUpperCase() + option.streamType.slice(1)
    : null;

  return [option.className, option.yearGroup, stream].filter(Boolean).join(" | ");
}

function resolvePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return null;
  }

  const trimmed = photoUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return encodeURI(trimmed);
  }

  return encodeURI(`/${trimmed}`);
}

function cleanPhotoToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const withoutExtension = value.replace(/\.[a-z0-9]+$/i, "");
  const withoutTimestamp = withoutExtension.replace(/_\d+$/i, "");
  const alphanumericOnly = withoutTimestamp.replace(/[^a-z0-9]+/gi, "");

  return alphanumericOnly || null;
}

function buildPhotoCandidates(
  photoUrl: string | null | undefined,
  staffName: string,
  firstName?: string | null
) {
  const directUrl = resolvePhotoUrl(photoUrl);
  const candidates = new Set<string>();

  if (directUrl) {
    candidates.add(directUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");

  if (!supabaseUrl) {
    return Array.from(candidates);
  }

  const storageBase = `${supabaseUrl}/storage/v1/object/public/staff-photos`;
  const fileName = photoUrl?.split("/").pop() ?? "";
  const fileExtensionMatch = fileName.match(/\.([a-z0-9]+)$/i);
  const existingExtension = fileExtensionMatch ? fileExtensionMatch[1].toLowerCase() : null;

  const baseNames = [
    cleanPhotoToken(fileName),
    cleanPhotoToken(staffName),
    cleanPhotoToken(firstName)
  ].filter((value): value is string => Boolean(value));

  const extensions = Array.from(
    new Set([existingExtension, "png", "jpg", "jpeg", "webp"].filter((value): value is string => Boolean(value)))
  );

  for (const baseName of baseNames) {
    for (const extension of extensions) {
      candidates.add(encodeURI(`${storageBase}/${baseName}.${extension}`));
    }
  }

  return Array.from(candidates);
}

type StaffAvatarProps = {
  photoUrl: string | null | undefined;
  staffName: string;
  firstName?: string | null;
  alt: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">;
};

function StaffAvatar({
  photoUrl,
  staffName,
  firstName,
  alt,
  fallback,
  className = "",
  imageClassName = "",
  imgProps
}: StaffAvatarProps) {
  const photoCandidates = useMemo(
    () => buildPhotoCandidates(photoUrl, staffName, firstName),
    [firstName, photoUrl, staffName]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [photoCandidates]);

  const resolvedPhotoUrl = photoCandidates[candidateIndex] ?? null;
  const showImage = Boolean(resolvedPhotoUrl);

  function handleImageError() {
    setCandidateIndex((current) => {
      if (current >= photoCandidates.length - 1) {
        return current;
      }

      return current + 1;
    });
  }

  return (
    <div className={className}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedPhotoUrl ?? undefined}
          alt={alt}
          className={imageClassName}
          onError={handleImageError}
          {...imgProps}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

export function StaffDirectory({
  staff,
  classOptions,
  showAdminGuidance = false,
  canManageStaff = true,
  heroSettings
}: StaffDirectoryProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [formValues, setFormValues] = useState<StaffDirectoryUpsertInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [staffHistory, setStaffHistory] = useState<StaffChangeLogEntry[]>([]);
  const [isStaffHistoryLoading, setIsStaffHistoryLoading] = useState(false);
  const [staffHistoryError, setStaffHistoryError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const departmentOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.department)),
    [staff]
  );
  const yearGroupOptions = useMemo(
    () => [
      ALL_TIMETABLES_ACCESS_VALUE,
      ...uniqueValues(classOptions.map((option) => option.yearGroup))
    ],
    [classOptions]
  );
  const knownClassLookup = useMemo(
    () => buildKnownClassLookup(classOptions),
    [classOptions]
  );
  const classYearGroupLookup = useMemo(
    () => buildClassYearGroupLookup(classOptions),
    [classOptions]
  );
  const teamOptions = useMemo(
    () =>
      uniqueValues(staff.map((person) => getStaffFilterTeamLabel(person, classYearGroupLookup))),
    [classYearGroupLookup, staff]
  );

  const filteredStaff = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return staff.filter((person) => {
      const matchesSearch =
        !search ||
        [
          person.name,
          person.first_name,
          person.role,
          person.email,
          person.team,
          person.sub_team,
          person.year_group_label,
          person.milepost_label,
          person.class,
          person.staff_id
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      const matchesDepartment =
        !departmentFilter || (person.department ?? "").trim() === departmentFilter;
      const matchesTeam =
        !teamFilter || getStaffFilterTeamLabel(person, classYearGroupLookup) === teamFilter;

      return matchesSearch && matchesDepartment && matchesTeam;
    });
  }, [classYearGroupLookup, departmentFilter, searchTerm, staff, teamFilter]);

  const groupedStaffSections = useMemo(
    () => buildStaffTeamSections(filteredStaff, classYearGroupLookup),
    [classYearGroupLookup, filteredStaff]
  );
  const exportRows = useMemo(() => buildStaffExportRows(filteredStaff), [filteredStaff]);

  const selectedStaff =
    filteredStaff.find((person) => person.id === selectedStaffId) ??
    staff.find((person) => person.id === selectedStaffId) ??
    null;

  useEffect(() => {
    if (!canManageStaff || !selectedStaffId || modalMode === "create") {
      setStaffHistory([]);
      setStaffHistoryError(null);
      setIsStaffHistoryLoading(false);
      return;
    }

    const staffRecordId = selectedStaffId;
    let isMounted = true;

    async function loadStaffHistory() {
      setIsStaffHistoryLoading(true);
      setStaffHistoryError(null);

      try {
        const params = new URLSearchParams();
        params.set("staffRecordId", staffRecordId);
        const response = await fetch(`/api/staff/history?${params.toString()}`);
        const json = (await response.json()) as StaffHistoryResponse;

        if (!response.ok) {
          throw new Error(json.error ?? "Could not load staff history.");
        }

        if (isMounted) {
          setStaffHistory(json.history ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setStaffHistory([]);
          setStaffHistoryError(
            error instanceof Error ? error.message : "Could not load staff history."
          );
        }
      } finally {
        if (isMounted) {
          setIsStaffHistoryLoading(false);
        }
      }
    }

    void loadStaffHistory();

    return () => {
      isMounted = false;
    };
  }, [canManageStaff, modalMode, selectedStaffId]);

  function actionStateClass(personId: string, mode: Exclude<ModalMode, "create">) {
    return selectedStaffId === personId && modalMode === mode ? " active" : "";
  }

  function closeModal() {
    setSelectedStaffId(null);
    setModalMode(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setIsSaving(false);
    setIsUploadingPhoto(false);
    setPhotoUploadError(null);
    setStaffHistory([]);
    setStaffHistoryError(null);
    setIsStaffHistoryLoading(false);
  }

  function openCreateModal() {
    if (!canManageStaff) {
      return;
    }

    setSelectedStaffId(null);
    setModalMode("create");
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setPhotoUploadError(null);
    setIsUploadingPhoto(false);
  }

  function openViewModal(staffMember: StaffDirectoryRecord) {
    setSelectedStaffId(staffMember.id);
    setModalMode("view");
    setFormValues(toFormValues(staffMember));
    setFormError(null);
    setPhotoUploadError(null);
    setIsUploadingPhoto(false);
  }

  function openEditModal(staffMember: StaffDirectoryRecord) {
    if (!canManageStaff) {
      return;
    }

    setSelectedStaffId(staffMember.id);
    setModalMode("edit");
    setFormValues(toFormValues(staffMember));
    setFormError(null);
    setPhotoUploadError(null);
    setIsUploadingPhoto(false);
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPhotoUploadError(null);
    setIsUploadingPhoto(true);

    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("staffName", formValues.name || formValues.first_name || "staff");

      const response = await fetch("/api/staff/photo", {
        method: "POST",
        body: payload
      });

      const result = (await response.json().catch(() => null)) as
        | { publicUrl?: string; error?: string }
        | null;

      if (!response.ok || !result?.publicUrl) {
        throw new Error(result?.error || "Photo upload failed.");
      }

      setFormValues((current) => ({
        ...current,
        photo_url: result.publicUrl ?? current.photo_url
      }));
    } catch (error) {
      setPhotoUploadError(
        error instanceof Error ? error.message : "We couldn't upload that photo just now."
      );
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  }

  async function handleSave() {
    if (!canManageStaff) {
      return;
    }

    setFormError(null);

    if (!String(formValues.name ?? "").trim()) {
      setFormError("Staff name is required.");
      return;
    }

    if (
      (formValues.can_view_own_timetable || formValues.can_edit_own_timetable) &&
      !String(formValues.class ?? "").trim()
    ) {
      setFormError("Assign a class before enabling own timetable access.");
      return;
    }

    if (formValues.can_view_class && !String(formValues.class ?? "").trim()) {
      setFormError("Assign a class before enabling class access.");
      return;
    }

    if (
      (formValues.can_view_year_group_timetables || formValues.can_view_year_group_classes) &&
      !String(formValues.timetable_access_year_group ?? "").trim()
    ) {
      setFormError("Choose a year group or select All Timetables before enabling year group access.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...formValues,
        max_duties:
          formValues.max_duties === null || formValues.max_duties === undefined
            ? null
            : Number(formValues.max_duties)
      };

      const response = await fetch(
        modalMode === "create" ? "/api/staff" : `/api/staff/${selectedStaffId}`,
        {
          method: modalMode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save staff member.");
      }

      router.refresh();
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save staff member.");
      setIsSaving(false);
    }
  }

  async function handleDelete(staffMember: StaffDirectoryRecord) {
    if (!canManageStaff) {
      return;
    }

    const confirmed = window.confirm(`Delete ${staffMember.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/staff/${staffMember.id}`, {
        method: "DELETE"
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete staff member.");
      }

      router.refresh();
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete staff member.");
      setIsSaving(false);
    }
  }

  const activeStaff = modalMode === "create" ? null : selectedStaff;

  function downloadBlob(filename: string, content: BlobPart, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportStaffCsv() {
    const headers = [
      "Staff ID",
      "Name",
      "First Name",
      "Role",
      "Email",
      "Department",
      "Team",
      "Sub Team",
      "Year Group Label",
      "Milepost Label",
      "Designation",
      "Assigned Class",
      "Timetable Label",
      "Year Group Access",
      "Extension",
      "Status",
      "Max Duties",
      "Assigned Duties"
    ];

    const lines = [
      headers.join(","),
      ...exportRows.map((row) =>
        [
          row.staffId,
          row.name,
          row.firstName,
          row.role,
          row.email,
          row.department,
          row.team,
          row.subTeam,
          row.yearGroupLabel,
          row.milepostLabel,
          row.designation,
          row.assignedClass,
          row.timetableLabel,
          row.yearGroupAccess,
          row.extension,
          row.status,
          row.maxDuties,
          row.duties
        ]
          .map(csvEscape)
          .join(",")
      )
    ];

    downloadBlob(
      `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${lines.join("\n")}`,
      "text/csv;charset=utf-8;"
    );
  }

  function exportStaffXls() {
    const headers = [
      "Staff ID",
      "Name",
      "First Name",
      "Role",
      "Email",
      "Department",
      "Team",
      "Sub Team",
      "Year Group Label",
      "Milepost Label",
      "Designation",
      "Assigned Class",
      "Timetable Label",
      "Year Group Access",
      "Extension",
      "Status",
      "Max Duties",
      "Assigned Duties"
    ];

    const rowsHtml = exportRows
      .map(
        (row) => `
          <tr>
            <td>${htmlEscape(row.staffId)}</td>
            <td>${htmlEscape(row.name)}</td>
            <td>${htmlEscape(row.firstName)}</td>
            <td>${htmlEscape(row.role)}</td>
            <td>${htmlEscape(row.email)}</td>
            <td>${htmlEscape(row.department)}</td>
            <td>${htmlEscape(row.team)}</td>
            <td>${htmlEscape(row.subTeam)}</td>
            <td>${htmlEscape(row.yearGroupLabel)}</td>
            <td>${htmlEscape(row.milepostLabel)}</td>
            <td>${htmlEscape(row.designation)}</td>
            <td>${htmlEscape(row.assignedClass)}</td>
            <td>${htmlEscape(row.timetableLabel)}</td>
            <td>${htmlEscape(row.yearGroupAccess)}</td>
            <td>${htmlEscape(row.extension)}</td>
            <td>${htmlEscape(row.status)}</td>
            <td>${htmlEscape(row.maxDuties)}</td>
            <td>${htmlEscape(row.duties)}</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table border="1">
      <thead>
        <tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;

    downloadBlob(
      `staff-directory-${new Date().toISOString().slice(0, 10)}.xls`,
      `\uFEFF${html}`,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="directory-hero">
        <div>
          <p className="eyebrow">{heroSettings?.eyebrow ?? "HELP Staff Workspace"}</p>
          <h1 className="directory-page-title">{heroSettings?.title ?? "Staff Directory"}</h1>
          <p className="directory-page-copy">
            {heroSettings?.description ??
              (canManageStaff
                ? "Manage teaching staff profiles and information"
                : "Browse teaching staff profiles and contact information")}
          </p>
        </div>
        <div className="actions">
          <button className="button secondary" type="button" onClick={exportStaffCsv}>
            Download CSV
          </button>
          <button className="button secondary" type="button" onClick={exportStaffXls}>
            Download XLS
          </button>
          {canManageStaff ? (
            <button className="directory-add-button" type="button" onClick={openCreateModal}>
              + Add Staff Member
            </button>
          ) : null}
        </div>
      </section>

      <section className="directory-search-panel">
        <div className="directory-search-grid">
          <div className="field directory-search-field">
            <label htmlFor="staffSearch">Search Staff</label>
            <input
              id="staffSearch"
              type="text"
              placeholder="Search by name, role, class, ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="departmentFilter">Department</label>
            <select
              id="departmentFilter"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="">All Departments</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="teamFilter">Team</label>
            <select
              id="teamFilter"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
            >
              <option value="">All Teams</option>
              {teamOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showAdminGuidance ? (
          <div className="directory-guidance-panel">
            <p className="directory-guidance-title">Field guide for team organisation</p>
            <p className="directory-guidance-copy">
              <strong>Team:</strong> use this for the main Staff Directory section such as{" "}
              <code>SLT</code>, <code>Preschool</code>, <code>MP1</code>, <code>MP2</code>,{" "}
              <code>MP3</code>, <code>Specialist</code>, or <code>Support</code>.
            </p>
            <p className="directory-guidance-copy">
              <strong>Sub Team:</strong> use this for the subgroup heading shown inside each
              section, such as <code>Year 1</code>, <code>Year 6</code>, <code>Music</code>, or{" "}
              <code>P.E.</code>.
            </p>
            <p className="directory-guidance-copy">
              <strong>Year Group Label</strong> and <strong>Milepost Label</strong> are now the
              staff-facing labels the app should use instead of trying to infer them from other
              fields.
            </p>
            <p className="directory-guidance-copy">
              <strong>Department</strong>, <strong>Role</strong>, and <strong>Designation</strong>{" "}
              can still describe the staff member, but they no longer need to secretly control the
              grouping structure.
            </p>
          </div>
        ) : null}
      </section>

      {groupedStaffSections.map((teamSection) => (
        <section className="directory-team-section" key={teamSection.key}>
          <div className="directory-team-header">
            <p className="eyebrow">{teamSection.title}</p>
            <h2 className="directory-team-title">{teamSection.title}</h2>
          </div>

          {teamSection.subGroups.map((subGroup) => (
            <div className="directory-team-subgroup" key={subGroup.key}>
              <h3 className="directory-team-subtitle">{subGroup.title}</h3>
              <div className="directory-card-grid">
                {subGroup.staff.map((person, index) => (
                  <article className="staff-management-card" key={person.id}>
                    <span className="staff-card-badge">#{person.staff_id ?? index + 1}</span>

                    <div className="staff-management-header">
                      <StaffAvatar
                        photoUrl={person.photo_url}
                        staffName={person.name}
                        firstName={person.first_name}
                        alt={person.name}
                        fallback={person.first_name?.[0] ?? person.name[0] ?? "?"}
                        className="directory-avatar management-avatar"
                        imageClassName="directory-avatar-image"
                      />
                      <div className="staff-management-copy">
                        <h2 className="directory-name">{person.name}</h2>
                        <p className="staff-management-line primary">
                          {person.department ?? "Department pending"}
                        </p>
                        <p className="staff-management-line accent">
                          {getStaffCardAccentLine(person, knownClassLookup)}
                        </p>
                      </div>
                    </div>

                    <div className="staff-card-actions">
                      {canManageStaff ? (
                        <button
                          className={`directory-action edit${actionStateClass(person.id, "edit")}`}
                          type="button"
                          onClick={() => openEditModal(person)}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        className={`directory-action view${actionStateClass(person.id, "view")}`}
                        type="button"
                        onClick={() => openViewModal(person)}
                      >
                        View
                      </button>
                      {canManageStaff ? (
                        <button
                          className="directory-action danger"
                          type="button"
                          onClick={() => handleDelete(person)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {!filteredStaff.length ? (
        <section className="panel">
          <div className="empty-state">No staff match the current search.</div>
        </section>
      ) : null}

      {modalMode ? (
        <div className="directory-modal-backdrop" role="presentation" onClick={closeModal}>
          <section
            className="directory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-directory-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="directory-modal-close" type="button" onClick={closeModal}>
              ×
            </button>

            <div className="directory-modal-header">
              <StaffAvatar
                photoUrl={activeStaff?.photo_url ?? formValues.photo_url}
                staffName={activeStaff?.name ?? formValues.name ?? ""}
                firstName={activeStaff?.first_name ?? formValues.first_name}
                alt={activeStaff?.name ?? formValues.name ?? "Staff member"}
                fallback={String(formValues.first_name || formValues.name || "?").trim().charAt(0) || "?"}
                className="directory-avatar management-avatar large"
                imageClassName="directory-avatar-image"
              />
              <div>
                <h2 id="staff-directory-modal-title" className="directory-modal-title">
                  {modalMode === "create" ? "Add staff member" : activeStaff?.name ?? "Staff member"}
                </h2>
                <p className="staff-management-line primary">
                  {modalMode === "view" ? activeStaff?.role ?? "Staff" : "Edit staff details and class assignment"}
                </p>
                <p className="staff-management-line accent">
                  {modalMode === "view"
                    ? activeStaff
                      ? getStaffCardAccentLine(activeStaff, knownClassLookup)
                      : "Staff profile"
                    : "Class assignment can be updated here directly."}
                </p>
              </div>
            </div>

            {modalMode === "view" && activeStaff ? (
              <>
                <div className="directory-modal-grid">
                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Personal Information</h3>
                    <div className="directory-modal-list">
                      <div className="directory-modal-row">
                        <span>Staff ID</span>
                        <strong>{activeStaff.staff_id ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>First Name</span>
                        <strong>{activeStaff.first_name ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Email</span>
                        <strong>{activeStaff.email ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Role</span>
                        <strong>{activeStaff.role ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Status</span>
                        <strong>{activeStaff.status ?? "—"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Placement</h3>
                    <div className="directory-modal-list">
                      {activeStaff.class?.trim() ? (
                        <div className="directory-modal-row">
                          <span>Assigned Class</span>
                          <strong>{activeStaff.class}</strong>
                        </div>
                      ) : null}
                      {activeStaff.team?.trim() ? (
                        <div className="directory-modal-row">
                          <span>Directory Section</span>
                          <strong>{activeStaff.team}</strong>
                        </div>
                      ) : null}
                      {activeStaff.sub_team?.trim() &&
                      isDistinctPlacementValue(activeStaff.sub_team, activeStaff.team, activeStaff.class) ? (
                        <div className="directory-modal-row">
                          <span>Directory Group</span>
                          <strong>{activeStaff.sub_team}</strong>
                        </div>
                      ) : null}
                      {activeStaff.year_group_label?.trim() ? (
                        <div className="directory-modal-row">
                          <span>Year Group</span>
                          <strong>{activeStaff.year_group_label}</strong>
                        </div>
                      ) : null}
                      {activeStaff.milepost_label?.trim() ? (
                        <div className="directory-modal-row">
                          <span>Milepost</span>
                          <strong>{activeStaff.milepost_label}</strong>
                        </div>
                      ) : null}
                      {activeStaff.timetable_access_year_group?.trim() ? (
                        <div className="directory-modal-row">
                          <span>Year Group Access</span>
                          <strong>{activeStaff.timetable_access_year_group}</strong>
                        </div>
                      ) : null}
                      {isDistinctPlacementValue(activeStaff.department, activeStaff.team) ? (
                        <div className="directory-modal-row">
                          <span>Department</span>
                          <strong>{activeStaff.department}</strong>
                        </div>
                      ) : null}
                      {isDistinctPlacementValue(
                        activeStaff.designation,
                        activeStaff.department,
                        activeStaff.team,
                        activeStaff.year_group_label,
                        activeStaff.milepost_label
                      ) ? (
                        <div className="directory-modal-row">
                          <span>Designation</span>
                          <strong>{activeStaff.designation}</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Work Details</h3>
                    <div className="directory-modal-summary">
                      <span>Assigned Duties</span>
                      <strong>{activeStaff.assigned_duties.length}</strong>
                    </div>
                    <div className="directory-duty-stack">
                      {activeStaff.assigned_duties.length ? (
                        activeStaff.assigned_duties.map((duty) => (
                          <div className="directory-duty-pill" key={duty.id}>
                            {formatDutyLabel(duty)}
                          </div>
                        ))
                      ) : (
                        <div className="directory-duty-pill empty">No assigned duties</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="directory-modal-actions">
                  {canManageStaff ? (
                    <button className="directory-action edit" type="button" onClick={() => openEditModal(activeStaff)}>
                      Edit
                    </button>
                  ) : null}
                  {canManageStaff ? (
                    <button className="directory-action danger" type="button" onClick={() => handleDelete(activeStaff)}>
                      Delete
                    </button>
                  ) : null}
                  <button className="directory-action close" type="button" onClick={closeModal}>
                    Close
                  </button>
                </div>
                {canManageStaff ? (
                  <section className="directory-modal-footer-card">
                    <h3 className="directory-modal-heading">Recent changes</h3>
                    {isStaffHistoryLoading ? (
                      <p className="directory-history-meta">Loading change history...</p>
                    ) : staffHistoryError ? (
                      <p className="directory-history-error">{staffHistoryError}</p>
                    ) : staffHistory.length ? (
                      <div className="directory-history-list">
                        {staffHistory.map((entry) => (
                          <article className="directory-history-entry" key={entry.id}>
                            <p className="directory-history-change">
                              <strong>{entry.field_name.replace(/_/g, " ")}</strong>:{" "}
                              {entry.old_value || "blank"} → {entry.new_value || "blank"}
                            </p>
                            <p className="directory-history-meta">
                              {new Date(entry.changed_at).toLocaleString()} by{" "}
                              {entry.changed_by_email || "Unknown user"}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="directory-history-meta">No recorded changes yet.</p>
                    )}
                  </section>
                ) : null}
              </>
            ) : (
              <>
                <div className="directory-modal-grid">
                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Personal Information</h3>
                    <div className="directory-form-grid">
                      <label className="field">
                        <span>Staff ID</span>
                        <input
                          type="text"
                          value={String(formValues.staff_id ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, staff_id: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Full Name</span>
                        <input
                          type="text"
                          value={formValues.name}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>First Name</span>
                        <input
                          type="text"
                          value={String(formValues.first_name ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, first_name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input
                          type="email"
                          value={String(formValues.email ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, email: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Role</span>
                        <input
                          type="text"
                          value={String(formValues.role ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, role: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>System Role</span>
                        <input
                          type="text"
                          value={String(formValues.system_role ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, system_role: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Assignment and Status</h3>
                    <div className="directory-form-grid">
                      <label className="field">
                        <span>Department</span>
                        <input
                          type="text"
                          value={String(formValues.department ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, department: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Directory Section</span>
                        <input
                          type="text"
                          value={String(formValues.team ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, team: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Directory Group</span>
                        <input
                          type="text"
                          value={String(formValues.sub_team ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, sub_team: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Assigned Class</span>
                        <select
                          value={String(formValues.class ?? "")}
                          onChange={(event) => {
                            const nextClass = event.target.value;
                            const matchedOption = classOptions.find(
                              (option) => option.className === nextClass
                            );

                            setFormValues((current) => ({
                              ...current,
                              class: nextClass,
                              timetable_access_year_group:
                                current.can_view_year_group_timetables && !current.timetable_access_year_group
                                  ? matchedOption?.yearGroup ?? current.timetable_access_year_group
                                  : current.timetable_access_year_group
                            }));
                          }}
                        >
                          <option value="">No class assigned</option>
                          {classOptions.map((option) => (
                            <option
                              key={option.classCode || option.className}
                              value={option.className}
                            >
                              {classOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Year Group Label</span>
                        <input
                          type="text"
                          value={String(formValues.year_group_label ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              year_group_label: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Milepost Label</span>
                        <input
                          type="text"
                          value={String(formValues.milepost_label ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              milepost_label: event.target.value
                            }))
                          }
                        />
                      </label>
                      <div className="field field-span-2">
                        <p className="directory-form-help">
                          Use <strong>Year Group Label</strong> for class or year-group staff. Use{" "}
                          <strong>Milepost Label</strong> for milepost-wide staff. Keep only the one that
                          applies.
                        </p>
                      </div>
                      <label className="field">
                        <span>Timetable Label</span>
                        <input
                          type="text"
                          value={String(formValues.timetable ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, timetable: event.target.value }))
                          }
                        />
                      </label>
                      <div className="field field-span-2">
                        <span>Timetable Access</span>
                        <div className="directory-access-grid">
                          <label className="directory-checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues.can_view_own_timetable)}
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  can_view_own_timetable: event.target.checked,
                                  can_edit_own_timetable: event.target.checked
                                    ? current.can_edit_own_timetable
                                    : false
                                }))
                              }
                            />
                            <span>Can view own timetable</span>
                          </label>
                          <label className="directory-checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues.can_edit_own_timetable)}
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  can_edit_own_timetable: event.target.checked,
                                  can_view_own_timetable: event.target.checked
                                    ? true
                                    : current.can_view_own_timetable
                                }))
                              }
                            />
                            <span>Can edit own timetable</span>
                          </label>
                          <label className="directory-checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues.can_view_year_group_timetables)}
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  can_view_year_group_timetables: event.target.checked,
                                  timetable_access_year_group: event.target.checked
                                    ? current.timetable_access_year_group || ALL_TIMETABLES_ACCESS_VALUE
                                    : ""
                                }))
                              }
                            />
                            <span>Can view year group timetables</span>
                          </label>
                          <label className="directory-checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues.can_view_class)}
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  can_view_class: event.target.checked
                                }))
                              }
                            />
                            <span>Can view class</span>
                          </label>
                          <label className="directory-checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues.can_view_year_group_classes)}
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  can_view_year_group_classes: event.target.checked,
                                  timetable_access_year_group: event.target.checked
                                    ? current.timetable_access_year_group || ALL_TIMETABLES_ACCESS_VALUE
                                    : current.can_view_year_group_timetables
                                      ? current.timetable_access_year_group
                                      : ""
                                }))
                              }
                            />
                            <span>Can view year group classes</span>
                          </label>
                          <label className="field">
                            <span>Year Group Access</span>
                            <select
                              value={String(formValues.timetable_access_year_group ?? "")}
                              disabled={
                                !formValues.can_view_year_group_timetables &&
                                !formValues.can_view_year_group_classes
                              }
                              onChange={(event) =>
                                setFormValues((current) => ({
                                  ...current,
                                  timetable_access_year_group: event.target.value
                                }))
                              }
                            >
                              <option value="">Select year group or all timetables</option>
                              {yearGroupOptions.map((yearGroup) => (
                                <option key={yearGroup} value={yearGroup}>
                                  {yearGroup}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <label className="field">
                        <span>Status</span>
                        <input
                          type="text"
                          value={String(formValues.status ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, status: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Designation</span>
                        <input
                          type="text"
                          value={String(formValues.designation ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, designation: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Extension</span>
                        <input
                          type="text"
                          value={String(formValues.extension ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, extension: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Max Duties</span>
                        <input
                          type="number"
                          min="0"
                          value={formValues.max_duties ?? ""}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              max_duties: event.target.value ? Number(event.target.value) : null
                            }))
                          }
                        />
                      </label>
                      <div className="field field-span-2">
                        <span>Staff Photo</span>
                        <div className="directory-photo-upload-row">
                          <label className="directory-upload-button">
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              disabled={isSaving || isUploadingPhoto}
                            />
                            {isUploadingPhoto ? "Uploading photo..." : "Upload Photo"}
                          </label>
                          <span
                            className={`directory-upload-status${
                              formValues.photo_url ? "" : " muted"
                            }`}
                          >
                            {formValues.photo_url ? "Photo ready" : "No photo uploaded"}
                          </span>
                        </div>
                        {photoUploadError ? (
                          <p className="directory-upload-error">{photoUploadError}</p>
                        ) : null}
                      </div>
                      <label className="field field-span-2">
                        <span>Unavailable Reason</span>
                        <textarea
                          rows={3}
                          value={String(formValues.unavailable_reason ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              unavailable_reason: event.target.value
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {formError ? <p className="directory-form-error">{formError}</p> : null}

                <div className="directory-modal-actions">
                  <button className="directory-action edit" type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : modalMode === "create" ? "Add Staff Member" : "Save Changes"}
                  </button>
                  {activeStaff ? (
                    <button
                      className="directory-action danger"
                      type="button"
                      onClick={() => handleDelete(activeStaff)}
                      disabled={isSaving}
                    >
                      Delete
                    </button>
                  ) : null}
                  <button className="directory-action close" type="button" onClick={closeModal} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
                {activeStaff && canManageStaff ? (
                  <section className="directory-modal-footer-card">
                    <h3 className="directory-modal-heading">Recent changes</h3>
                    {isStaffHistoryLoading ? (
                      <p className="directory-history-meta">Loading change history...</p>
                    ) : staffHistoryError ? (
                      <p className="directory-history-error">{staffHistoryError}</p>
                    ) : staffHistory.length ? (
                      <div className="directory-history-list">
                        {staffHistory.map((entry) => (
                          <article className="directory-history-entry" key={entry.id}>
                            <p className="directory-history-change">
                              <strong>{entry.field_name.replace(/_/g, " ")}</strong>:{" "}
                              {entry.old_value || "blank"} → {entry.new_value || "blank"}
                            </p>
                            <p className="directory-history-meta">
                              {new Date(entry.changed_at).toLocaleString()} by{" "}
                              {entry.changed_by_email || "Unknown user"}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="directory-history-meta">No recorded changes yet.</p>
                    )}
                  </section>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
