import { NextResponse } from "next/server";
import {
  createSpecialistRegister,
  getSpecialistRegisters
} from "@/lib/data";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull } from "@/lib/auth";
import { canAccessView } from "@/lib/access";

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const registers = await getSpecialistRegisters({
      staffProfileId: preview.activeProfile.id,
      subjectId: url.searchParams.get("subjectId"),
      yearGroup: url.searchParams.get("yearGroup")
    });

    return NextResponse.json({ registers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load specialist registers." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const register = await createSpecialistRegister({
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
      { error: error instanceof Error ? error.message : "Unable to create specialist register." },
      { status: 400 }
    );
  }
}
