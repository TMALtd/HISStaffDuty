import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getGradebookSectionSettings, upsertGradebookSectionSettings } from "@/lib/data";

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sections = await getGradebookSectionSettings();
    return NextResponse.json({ sections });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load markbook sections." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sections = await upsertGradebookSectionSettings(body.sections ?? []);
    return NextResponse.json({ sections });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save markbook sections." },
      { status: 400 }
    );
  }
}
