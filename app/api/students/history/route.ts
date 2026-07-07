import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getStudentChangeLog } from "@/lib/data";

export async function GET(request: Request) {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can view student change history." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentSchoolId = String(searchParams.get("studentSchoolId") ?? "").trim();
  const academicYearLabel = searchParams.get("academicYearLabel");

  if (!studentSchoolId) {
    return NextResponse.json({ error: "Student school ID is required." }, { status: 400 });
  }

  try {
    const history = await getStudentChangeLog({
      studentSchoolId,
      academicYearLabel: academicYearLabel && academicYearLabel.trim() ? academicYearLabel : undefined
    });

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load student change history." },
      { status: 400 }
    );
  }
}
