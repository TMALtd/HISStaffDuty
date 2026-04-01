import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  type FilterField,
  type FilterOptions,
  type FilterState,
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
      "class_code,class_name,school,designation,year_group,milepost,level,school_id,full_name,preferred_name,gender,form,year_code,tutor,academic_house"
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

  return (data ?? []) as StudentRow[];
}
