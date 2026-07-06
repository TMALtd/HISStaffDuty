import { NextResponse } from "next/server";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getTimetableBuilderData, upsertTimetableBlock } from "@/lib/data";
import { canEditTimetableClass } from "@/lib/access";
import type { TimetableBlockType } from "@/lib/types";

type TimetableRouteContext = {
  params: {
    classCode: string;
  };
};

export async function POST(request: Request, context: TimetableRouteContext) {
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

    const body = await request.json();

    await upsertTimetableBlock({
      classCode,
      blockId: String(body.blockId ?? ""),
      title: body.title ?? null,
      blockType: String(body.blockType ?? "lesson") as TimetableBlockType,
      color: body.color ?? null,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      notes: body.notes ?? null,
      staffIds: Array.isArray(body.staffIds) ? body.staffIds.map(String) : []
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save timetable block." },
      { status: 500 }
    );
  }
}
