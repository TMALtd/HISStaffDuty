import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  type DutyDashboardData,
  type DutyRosterAssignment,
  type DutyRosterGroup,
  type DutyRosterRecord,
  type DutyRosterSubGroup,
  type DutySummary,
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
  const { data, error } = await supabase.from(TABLE_NAME).select("*");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ClassRecord[]).sort((left, right) =>
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

export async function getDutyRosterData(): Promise<DutyRosterRecord[]> {
  const [staff, duties] = await Promise.all([getStaffDirectoryData(), getActiveDutyRows()]);

  const staffLookup = new Map(
    staff.map((person) => [
      person.id,
      {
        name: person.name,
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
      assignedStaffDepartment: assignedStaff?.department ?? null,
      assignedStaffPhotoUrl: assignedStaff?.photo_url ?? null,
      isAssigned: Boolean(duty.assignedStaffId && assignedStaff)
    };
  });
}

export async function getDutyRosterGroups(): Promise<DutyRosterGroup[]> {
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

  return topLevelRows
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
