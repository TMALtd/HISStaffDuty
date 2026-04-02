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
  form: string;
  year_code: string | null;
  tutor: string | null;
  academic_house: string | null;
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
