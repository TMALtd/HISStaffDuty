import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { resetTimetableBlock } from "@/lib/data";

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

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await resetTimetableBlock({
      classCode: decodeURIComponent(context.params.classCode),
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
