import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import {
  archiveLegacyStudentRoster,
  getStudentAcademicYears,
  getStudentRosterClassOptions,
  importStudentRosterClassCsv,
  setActiveStudentAcademicYear,
  upsertStudentAcademicYear
} from "@/lib/data";

export async function GET() {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can manage academic years." }, { status: 403 });
  }

  try {
    const [academicYears, classOptions] = await Promise.all([
      getStudentAcademicYears(),
      getStudentRosterClassOptions()
    ]);

    return NextResponse.json({ academicYears, classOptions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load student roster setup." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can manage academic years." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "create-year") {
      const academicYears = await upsertStudentAcademicYear({
        label: String(body.label ?? ""),
        startsOn: body.startsOn ?? null,
        endsOn: body.endsOn ?? null,
        isActive: Boolean(body.isActive),
        isArchived: Boolean(body.isArchived)
      });
      return NextResponse.json({ academicYears });
    }

    if (action === "activate-year") {
      const academicYears = await setActiveStudentAcademicYear(String(body.label ?? ""));
      return NextResponse.json({ academicYears });
    }

    if (action === "archive-current") {
      const academicYears = await archiveLegacyStudentRoster({
        academicYearLabel: String(body.label ?? ""),
        archivedByEmail: session.user.email ?? null
      });
      return NextResponse.json({ academicYears });
    }

    if (action === "import-class-csv") {
      const summary = await importStudentRosterClassCsv({
        academicYearLabel: String(body.academicYearLabel ?? ""),
        classCode: body.classCode ?? null,
        className: body.className ?? null,
        csvText: String(body.csvText ?? ""),
        sourceFilename: body.sourceFilename ?? null
      });

      const [academicYears, classOptions] = await Promise.all([
        getStudentAcademicYears(),
        getStudentRosterClassOptions(String(body.academicYearLabel ?? ""))
      ]);
      return NextResponse.json({ summary, academicYears, classOptions });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update student roster setup." },
      { status: 400 }
    );
  }
}
