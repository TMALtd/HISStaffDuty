import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getPortalPageAccessSettings, upsertPortalPageAccessSettings } from "@/lib/data";

export async function GET() {
  const session = await getCurrentStaffAccessOrNull();
  if (!session?.access.isFullAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getPortalPageAccessSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load page access settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session?.access.isFullAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settings = await upsertPortalPageAccessSettings(body.settings ?? []);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save page access settings." },
      { status: 400 }
    );
  }
}
