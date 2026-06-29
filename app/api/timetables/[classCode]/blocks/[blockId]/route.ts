import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getTimetableBuilderData, resetTimetableBlock } from "@/lib/data";
import { canEditTimetableClass } from "@/lib/access";

type TimetableRouteContext = {
  params: {
    classCode: string;
    blockId: string;
  };
};

export async function DELETE(_request: Request, context: TimetableRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const classCode = decodeURIComponent(context.params.classCode);
    const data = await getTimetableBuilderData(classCode);

    if (!canEditTimetableClass(session.access, data.classSummary)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await resetTimetableBlock({
      classCode,
      blockId: decodeURIComponent(context.params.blockId)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset timetable block." },
      { status: 500 }
    );
  }
}
