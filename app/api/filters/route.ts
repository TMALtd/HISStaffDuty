import { NextResponse } from "next/server";
import { filterStudentsForAccess } from "@/lib/access";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { getFilterOptions, getFilterOptionsForAcademicYear, getStudents } from "@/lib/data";
import { FILTER_FIELDS, type FilterField, type FilterOptions, type FilterState, type StudentRow, toQueryFilters } from "@/lib/types";

function buildFilterOptionsFromStudents(students: StudentRow[], filters: Partial<FilterState>): FilterOptions {
  const normalized = {
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

  FILTER_FIELDS.forEach((field, index) => {
    const options = Array.from(
      new Set(
        students
          .filter((row) => {
            if (index >= 1 && normalized.school && row.school !== normalized.school) {
              return false;
            }
            if (index >= 2 && normalized.designation && row.designation !== normalized.designation) {
              return false;
            }
            if (index >= 3 && normalized.yearGroup && row.year_group !== normalized.yearGroup) {
              return false;
            }
            if (index >= 4 && normalized.milepost && row.milepost !== normalized.milepost) {
              return false;
            }
            if (index >= 5 && normalized.level && row.level !== normalized.level) {
              return false;
            }

            return true;
          })
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
    const options = preview && !preview.activeAccess.isFullAccess
      ? buildFilterOptionsFromStudents(
          filterStudentsForAccess(
            await getStudents({}, session?.access.isFullAccess && !preview.isPreviewing ? academicYear : null),
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
