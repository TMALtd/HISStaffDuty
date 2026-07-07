import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getStaffChangeLog } from "@/lib/data";

export async function GET(request: Request) {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can view staff change history." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const staffRecordId = String(searchParams.get("staffRecordId") ?? "").trim();

  if (!staffRecordId) {
    return NextResponse.json({ error: "Staff record ID is required." }, { status: 400 });
  }

  try {
    const history = await getStaffChangeLog({ staffRecordId });
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load staff change history." },
      { status: 400 }
    );
  }
}
