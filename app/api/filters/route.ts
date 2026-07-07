import { NextResponse } from "next/server";
import { filterStudentsForAccess } from "@/lib/access";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { getFilterOptions, getFilterOptionsForAcademicYear, getStudents } from "@/lib/data";
import { FILTER_FIELDS, type FilterField, type FilterOptions, type FilterState, type StudentRow, toQueryFilters } from "@/lib/types";

function buildFilterOptionsFromStudents(students: StudentRow[], filters: Partial<FilterState>): FilterOptions {
  const normalized = {
    searchTerm: filters.searchTerm ?? "",
    school: filters.school ?? "",
    designation: filters.designation ?? "",
    yearGroup: filters.yearGroup ?? "",
    milepost: filters.milepost ?? "",
    level: filters.level ?? "",
    className: filters.className ?? ""
  };
  const result = {} as FilterOptions;

  const fieldValue = (row: StudentRow, field: FilterField) => {
    switch (field) {
      case "school":
        return row.school;
      case "designation":
        return row.designation;
      case "yearGroup":
        return row.year_group;
      case "milepost":
        return row.milepost;
      case "level":
        return row.level;
      case "className":
        return row.class_name;
    }
  };

  const matchesSelectedFiltersExcludingField = (row: StudentRow, field: FilterField) => {
    if (field !== "school" && normalized.school && row.school !== normalized.school) {
      return false;
    }
    if (field !== "designation" && normalized.designation && row.designation !== normalized.designation) {
      return false;
    }
    if (field !== "yearGroup" && normalized.yearGroup && row.year_group !== normalized.yearGroup) {
      return false;
    }
    if (field !== "milepost" && normalized.milepost && row.milepost !== normalized.milepost) {
      return false;
    }
    if (field !== "level" && normalized.level && row.level !== normalized.level) {
      return false;
    }
    if (field !== "className" && normalized.className && row.class_name !== normalized.className) {
      return false;
    }

    return true;
  };

  FILTER_FIELDS.forEach((field) => {
    const options = Array.from(
      new Set(
        students
          .filter((row) => matchesSelectedFiltersExcludingField(row, field))
          .map((row) => fieldValue(row, field))
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    result[field] = options;
  });

  return result;
}

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const filters = toQueryFilters(url.searchParams);
    const academicYear = url.searchParams.get("academicYear");
    const session = await getCurrentStaffAccessOrNull();
    const preview = session
      ? await getAccessPreviewSession(session, url.searchParams.get("viewAs"))
      : null;
    const academicYearForQuery =
      session?.access.isFullAccess && !preview?.isPreviewing ? academicYear : undefined;
    const options = preview && !preview.activeAccess.isFullAccess
      ? buildFilterOptionsFromStudents(
          filterStudentsForAccess(
            await getStudents({}, academicYearForQuery),
            preview.activeAccess
          ),
          filters
        )
      : session?.access.isFullAccess && academicYear
        ? await getFilterOptionsForAcademicYear(filters, academicYear)
        : await getFilterOptions(filters);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load filters." },
      { status: 500 }
    );
  }
}
