import { NextResponse } from "next/server";
import {
  deleteSpecialistRegister,
  getSpecialistRegisterDetail,
  updateSpecialistRegister
} from "@/lib/data";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull } from "@/lib/auth";
import { canAccessView } from "@/lib/access";

type SpecialistRegisterRouteContext = {
  params: {
    registerId: string;
  };
};

export async function GET(request: Request, context: SpecialistRegisterRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await getAccessPreviewSession(session, new URL(request.url).searchParams.get("viewAs"));
  if (!canAccessView(preview.activeAccess, "gradebook")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preview.activeProfile) {
    return NextResponse.json({ error: "No staff profile is linked to this account." }, { status: 400 });
  }

  try {
    const detail = await getSpecialistRegisterDetail({
      registerId: decodeURIComponent(context.params.registerId),
      staffProfileId: preview.activeProfile.id
    });

    if (!detail) {
      return NextResponse.json({ error: "Register not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load specialist register." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: SpecialistRegisterRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await getAccessPreviewSession(session, new URL(request.url).searchParams.get("viewAs"));
  if (!canAccessView(preview.activeAccess, "gradebook")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preview.activeProfile) {
    return NextResponse.json({ error: "No staff profile is linked to this account." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const register = await updateSpecialistRegister({
      registerId: decodeURIComponent(context.params.registerId),
      staffProfileId: preview.activeProfile.id,
      subjectId: body.subjectId,
      yearGroup: body.yearGroup,
      name: body.name,
      description: body.description ?? null,
      studentIds: Array.isArray(body.studentIds) ? body.studentIds : []
    });

    return NextResponse.json({ register });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update specialist register." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: SpecialistRegisterRouteContext) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await getAccessPreviewSession(session, new URL(request.url).searchParams.get("viewAs"));
  if (!canAccessView(preview.activeAccess, "gradebook")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preview.activeProfile) {
    return NextResponse.json({ error: "No staff profile is linked to this account." }, { status: 400 });
  }

  try {
    await deleteSpecialistRegister({
      registerId: decodeURIComponent(context.params.registerId),
      staffProfileId: preview.activeProfile.id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete specialist register." },
      { status: 400 }
    );
  }
}
