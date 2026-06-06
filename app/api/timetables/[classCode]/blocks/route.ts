import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { upsertTimetableBlock } from "@/lib/data";
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

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const classCode = decodeURIComponent(context.params.classCode);
    const body = await request.json();

    await upsertTimetableBlock({
      classCode,
      blockId: String(body.blockId ?? ""),
      title: body.title ?? null,
      blockType: String(body.blockType ?? "lesson") as TimetableBlockType,
      color: body.color ?? null,
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
