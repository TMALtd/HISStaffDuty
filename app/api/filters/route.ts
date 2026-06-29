import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { getFilterOptions, getFilterOptionsForAcademicYear } from "@/lib/data";
import { toQueryFilters } from "@/lib/types";

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
    const options =
      session?.access.isFullAccess && academicYear
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
