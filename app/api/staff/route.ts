import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { createStaffDirectoryRecord } from "@/lib/data";
import type { StaffDirectoryUpsertInput } from "@/lib/types";

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can manage staff records." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as StaffDirectoryUpsertInput;
    const staffRecord = await createStaffDirectoryRecord(body);
    return NextResponse.json({ staffRecord });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create staff member." },
      { status: 400 }
    );
  }
}
