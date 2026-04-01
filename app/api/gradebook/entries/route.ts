import { NextResponse } from "next/server";
import {
  deleteGradebookEntry,
  getGradebookEntries,
  getGradebookFieldDefinitions,
  getStudents,
  upsertGradebookEntry
} from "@/lib/data";
import { getCurrentUserOrNull } from "@/lib/auth";
import { toQueryFilters } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const assessmentName = url.searchParams.get("assessmentName") ?? "";
  const assessmentDate = url.searchParams.get("assessmentDate") ?? "";

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required." }, { status: 400 });
  }

  try {
    const filters = toQueryFilters(url.searchParams);
    const students = await getStudents(filters);
    const fields = await getGradebookFieldDefinitions(subjectId);
    const entries = await getGradebookEntries({
      subjectId,
      studentIds: students.map((student) => student.school_id),
      assessmentName,
      assessmentDate
    });

    return NextResponse.json({ students, fields, entries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load gradebook entries." },
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
    const entry = await upsertGradebookEntry({
      studentSchoolId: body.studentSchoolId,
      className: body.className,
      subjectId: body.subjectId,
      assessmentName: body.assessmentName,
      assessmentDate: body.assessmentDate,
      grade: body.grade ?? "",
      score: body.score ?? "",
      comment: body.comment ?? "",
      fieldValues: body.fieldValues ?? {}
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save gradebook entry." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await deleteGradebookEntry({
      studentSchoolId: body.studentSchoolId,
      subjectId: body.subjectId,
      assessmentName: body.assessmentName,
      assessmentDate: body.assessmentDate
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete gradebook entry." },
      { status: 500 }
    );
  }
}
