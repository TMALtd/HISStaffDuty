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
  preferred_name: string | null;
  gender: string | null;
  form: string;
  year_code: string | null;
  tutor: string | null;
  academic_house: string | null;
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
