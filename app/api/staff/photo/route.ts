import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function slugifyPhotoSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function inferPhotoExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  const fromType = file.type.split("/").pop()?.trim().toLowerCase();
  if (fromType && /^[a-z0-9.+-]+$/.test(fromType)) {
    return fromType === "jpeg" ? "jpg" : fromType;
  }

  return "png";
}

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can upload staff photos." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const staffName = String(formData.get("staffName") ?? "").trim();

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "Please choose a photo to upload." }, { status: 400 });
    }

    if (!uploadedFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Staff photos must be image files." }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const extension = inferPhotoExtension(uploadedFile);
    const baseName =
      slugifyPhotoSegment(staffName || uploadedFile.name.replace(/\.[^.]+$/, "")) || "staff-photo";
    const objectPath = `${baseName}-${Date.now()}.${extension}`;
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from("staff-photos")
      .upload(objectPath, fileBuffer, {
        cacheControl: "3600",
        contentType: uploadedFile.type || "application/octet-stream",
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = adminClient.storage.from("staff-photos").getPublicUrl(objectPath);

    return NextResponse.json({
      path: objectPath,
      publicUrl: data.publicUrl
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We couldn't upload that photo just now. Please try again."
      },
      { status: 400 }
    );
  }
}
