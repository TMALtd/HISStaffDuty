import { NextResponse } from "next/server";
import { createClassTimetable, deleteClassTimetable, getTimetableBuilderData } from "@/lib/data";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { canAccessTimetableClass } from "@/lib/access";

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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load timetable builder." },
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
    const timetable = await createClassTimetable({
      classCode,
      templateId: String(body.templateId ?? "")
    });

    return NextResponse.json({ timetable });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create timetable." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: TimetableRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const classCode = decodeURIComponent(context.params.classCode);
    await deleteClassTimetable({ classCode });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete timetable." },
      { status: 500 }
    );
  }
}
