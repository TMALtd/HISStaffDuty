import { NextResponse } from "next/server";
import { createClassTimetable, deleteClassTimetable, getTimetableBuilderData } from "@/lib/data";
import { getCurrentUserOrNull } from "@/lib/auth";

type TimetableRouteContext = {
  params: {
    className: string;
  };
};

export async function GET(_request: Request, context: TimetableRouteContext) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const className = decodeURIComponent(context.params.className);
    const data = await getTimetableBuilderData(className);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load timetable builder." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: TimetableRouteContext) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const className = decodeURIComponent(context.params.className);
    const body = await request.json();
    const timetable = await createClassTimetable({
      className,
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
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const className = decodeURIComponent(context.params.className);
    await deleteClassTimetable({ className });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete timetable." },
      { status: 500 }
    );
  }
}
