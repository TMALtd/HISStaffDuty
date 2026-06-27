import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { getStaffDirectoryClassOptions, getStudents, upsertStudentClassAssignment } from "@/lib/data";
import { toQueryFilters } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filters = toQueryFilters(new URL(request.url).searchParams);
    const [students, classOptions] = await Promise.all([
      getStudents(filters),
      getStaffDirectoryClassOptions()
    ]);
    return NextResponse.json({ students, classOptions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load students." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can update student class placement." }, { status: 403 });
  }

  try {
    const body = await request.json();
    await upsertStudentClassAssignment(
      {
        studentSchoolId: body.studentSchoolId,
        className: body.className ?? null,
        classCode: body.classCode ?? null
      },
      session.user.email ?? null
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update student class placement." },
      { status: 400 }
    );
  }
}
