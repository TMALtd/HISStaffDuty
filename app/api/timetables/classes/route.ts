import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getTimetableClassSummaries, getTimetableTemplates } from "@/lib/data";

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [classes, templates] = await Promise.all([
      getTimetableClassSummaries(),
      getTimetableTemplates()
    ]);

    return NextResponse.json({ classes, templates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load timetable classes." },
      { status: 500 }
    );
  }
}
