import { NextResponse } from "next/server";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getTimetableBuilderData, resetTimetableBlock } from "@/lib/data";
import { canEditTimetableClass } from "@/lib/access";

type TimetableRouteContext = {
  params: {
    classCode: string;
    blockId: string;
  };
};

export async function DELETE(request: Request, context: TimetableRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preview = await getAccessPreviewSession(session, new URL(request.url).searchParams.get("viewAs"));
    const classCode = decodeURIComponent(context.params.classCode);
    const data = await getTimetableBuilderData(classCode);

    if (!canEditTimetableClass(preview.activeAccess, data.classSummary)) {
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
