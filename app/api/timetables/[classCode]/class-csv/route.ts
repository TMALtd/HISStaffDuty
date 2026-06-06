import { NextResponse } from "next/server";
import { exportClassTimetableCsv, importClassTimetableCsv } from "@/lib/data";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { canAccessTimetableClass } from "@/lib/access";
import { getTimetableBuilderData } from "@/lib/data";

type TimetableRouteContext = {
  params: {
    classCode: string;
  };
};

export async function GET(_request: Request, context: TimetableRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const classCode = decodeURIComponent(context.params.classCode);
    const data = await getTimetableBuilderData(classCode);

    if (!canAccessTimetableClass(session.access, data.classSummary)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await exportClassTimetableCsv({ classCode });

    return new NextResponse(result.csvText, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export class timetable CSV." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: TimetableRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const classCode = decodeURIComponent(context.params.classCode);
    const body = await request.json();
    const result = await importClassTimetableCsv({
      classCode,
      csvText: String(body.csvText ?? "")
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import class timetable CSV." },
      { status: 500 }
    );
  }
}
