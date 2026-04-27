import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { resetTimetableBlock } from "@/lib/data";

type TimetableRouteContext = {
  params: {
    className: string;
    blockId: string;
  };
};

export async function DELETE(_request: Request, context: TimetableRouteContext) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await resetTimetableBlock({
      className: decodeURIComponent(context.params.className),
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
