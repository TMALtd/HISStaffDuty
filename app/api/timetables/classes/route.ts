import { NextResponse } from "next/server";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull } from "@/lib/auth";
import { filterTimetableClassesForAccess } from "@/lib/access";
import { createTimetableClass, getTimetableAdminData } from "@/lib/data";

export async function GET(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const preview = await getAccessPreviewSession(session, searchParams.get("viewAs"));
    const { classes, templates, setupMessage } = await getTimetableAdminData();

    return NextResponse.json({
      classes: filterTimetableClassesForAccess(classes, preview.activeAccess),
      templates,
      setupMessage
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load timetable classes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can add timetable classes." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      classCode?: string;
      className?: string;
      yearGroup?: string;
      streamType?: "mainstream" | "bilingual";
    };

    const yearGroup = String(body.yearGroup ?? "").trim();
    const streamType = body.streamType === "bilingual" ? "bilingual" : "mainstream";

    const created = await createTimetableClass({
      classCode: String(body.classCode ?? ""),
      className: String(body.className ?? ""),
      school: "Primary",
      designation: streamType,
      yearGroup,
      milepost: "",
      level: "Primary",
      streamType
    });

    return NextResponse.json({ classRecord: created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create timetable class." },
      { status: 400 }
    );
  }
}
