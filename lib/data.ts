import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  type GradebookEntry,
  type GradebookFieldDefinition,
  type GradebookSubject,
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
const SUBJECTS_TABLE = "gradebook_subjects";
const FIELDS_TABLE = "gradebook_field_definitions";
const ENTRIES_TABLE = "gradebook_entries";

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
}): Promise<GradebookEntry[]> {
  if (!params.assessmentName || !params.assessmentDate || !params.studentIds.length) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(ENTRIES_TABLE)
    .select(
      "id,student_school_id,class_name,subject_id,assessment_name,assessment_date,grade,score,comment,field_values"
    )
    .eq("subject_id", params.subjectId)
    .eq("assessment_name", params.assessmentName)
    .eq("assessment_date", params.assessmentDate)
    .in("student_school_id", params.studentIds);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GradebookEntry[]).map((entry) => ({
    ...entry,
    field_values: entry.field_values ?? {}
  }));
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
