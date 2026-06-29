import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getPortalHeroSettings, upsertPortalHeroSettings } from "@/lib/data";

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getPortalHeroSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load portal card text." },
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
    const settings = await upsertPortalHeroSettings(body.settings ?? []);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save portal card text." },
      { status: 400 }
    );
  }
}
