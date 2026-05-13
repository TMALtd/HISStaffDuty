import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { upsertTimetableBlock } from "@/lib/data";
import type { TimetableBlockType } from "@/lib/types";

type TimetableRouteContext = {
  params: {
    className: string;
  };
};

export async function POST(request: Request, context: TimetableRouteContext) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const className = decodeURIComponent(context.params.className);
    const body = await request.json();

    await upsertTimetableBlock({
      className,
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
