import { NextResponse } from "next/server";
import {
  deleteGradebookEntry,
  getGradebookAssessments,
  getGradebookSubjectById,
  getGradebookTerms,
  getGradebookEntries,
  getGradebookFieldDefinitions,
  getStaffDirectoryClassOptions,
  getStudents,
  upsertGradebookEntry
} from "@/lib/data";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { filterStudentsForAccess } from "@/lib/access";
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
    const session = await getCurrentStaffAccessOrNull();
    const preview = session
      ? await getAccessPreviewSession(session, url.searchParams.get("viewAs"))
      : null;
    const subject = await getGradebookSubjectById(subjectId);
    const infoOnly = subject?.slug === "student-pastoral";
    const students = preview ? filterStudentsForAccess(await getStudents(filters), preview.activeAccess) : await getStudents(filters);
    const fields = await getGradebookFieldDefinitions(subjectId);
    const [entries, classOptions, assessments, terms] = await Promise.all([
      getGradebookEntries({
        subjectId,
        studentIds: students.map((student) => student.school_id),
        assessmentName,
        assessmentDate,
        infoOnly
      }),
      getStaffDirectoryClassOptions(),
      infoOnly ? Promise.resolve([]) : getGradebookAssessments({ subjectId, className: filters.className || undefined }),
      getGradebookTerms()
    ]);

    return NextResponse.json({ students, fields, entries, subject, classOptions, assessments, terms });
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
    if (Array.isArray(body.entries)) {
      const entries = await Promise.all(
        (body.entries as Array<{
          studentSchoolId: string;
          className: string;
          subjectId: string;
          assessmentName: string;
          assessmentDate: string;
          grade?: string;
          score?: string;
          comment?: string;
          fieldValues?: Record<string, string>;
        }>).map((entryBody) =>
          upsertGradebookEntry({
            studentSchoolId: entryBody.studentSchoolId,
            className: entryBody.className,
            subjectId: entryBody.subjectId,
            assessmentName: entryBody.assessmentName,
            assessmentDate: entryBody.assessmentDate,
            grade: entryBody.grade ?? "",
            score: entryBody.score ?? "",
            comment: entryBody.comment ?? "",
            fieldValues: entryBody.fieldValues ?? {}
          })
        )
      );

      return NextResponse.json({ entries });
    }

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
    if (Array.isArray(body.entries)) {
      await Promise.all(
        (body.entries as Array<{
          studentSchoolId: string;
          subjectId: string;
          assessmentName: string;
          assessmentDate: string;
        }>).map((entryBody) =>
          deleteGradebookEntry({
            studentSchoolId: entryBody.studentSchoolId,
            subjectId: entryBody.subjectId,
            assessmentName: entryBody.assessmentName,
            assessmentDate: entryBody.assessmentDate
          })
        )
      );

      return NextResponse.json({ ok: true });
    }

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
