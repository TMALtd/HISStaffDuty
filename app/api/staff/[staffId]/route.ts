import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { deleteStaffDirectoryRecord, updateStaffDirectoryRecord } from "@/lib/data";
import type { StaffDirectoryUpsertInput } from "@/lib/types";

type RouteContext = {
  params: {
    staffId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can manage staff records." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as StaffDirectoryUpsertInput;
    const staffRecord = await updateStaffDirectoryRecord(context.params.staffId, body, {
      changedByEmail: session.user.email ?? null,
      changeSource: "staff-directory-api"
    });
    return NextResponse.json({ staffRecord });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update staff member." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can manage staff records." }, { status: 403 });
  }

  try {
    await deleteStaffDirectoryRecord(context.params.staffId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete staff member." },
      { status: 400 }
    );
  }
}
