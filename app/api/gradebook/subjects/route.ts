import { NextResponse } from "next/server";
import {
  createGradebookSubject,
  getGradebookSubjects,
  getPrimarySpecialistSectionSlug
} from "@/lib/data";
import { getAccessPreviewSession, getCurrentUserOrNull, requirePortalAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await requirePortalAccess("gradebook");
    const url = new URL(request.url);
    const className = url.searchParams.get("className") || undefined;
    const previewEmail = url.searchParams.get("viewAs");
    const preview = await getAccessPreviewSession(session, previewEmail);
    const subjects = await getGradebookSubjects({
      className,
      staffProfile: preview.activeProfile,
      specialistSectionSlug:
        url.searchParams.get("specialistSectionSlug") ?? getPrimarySpecialistSectionSlug(preview.activeProfile)
    });
    return NextResponse.json({ subjects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load gradebook subjects." },
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
    const subject = await createGradebookSubject({
      name: body.name,
      className: body.className || null,
      isCore: Boolean(body.isCore)
    });

    return NextResponse.json({ subject });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create gradebook subject." },
      { status: 500 }
    );
  }
}
