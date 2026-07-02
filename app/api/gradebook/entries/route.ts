import { NextResponse } from "next/server";
import {
  deleteGradebookEntry,
  getGradebookAssessments,
  getGradebookSubjectById,
  getGradebookTerms,
  getGradebookEntries,
  getGradebookFieldDefinitions,
  getSpecialistRegisterDetail,
  getSpecialistRegisters,
  getStaffDirectoryClassOptions,
  getStudents,
  isSpecialistGradebookSubject,
  upsertGradebookEntry
} from "@/lib/data";
import { getAccessPreviewSession, getCurrentStaffAccessOrNull, getCurrentUserOrNull } from "@/lib/auth";
import { filterStudentsForAccess } from "@/lib/access";
import { toQueryFilters, type SpecialistRegister, type StudentRow } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const assessmentName = url.searchParams.get("assessmentName") ?? "";
  const assessmentDate = url.searchParams.get("assessmentDate") ?? "";
  const registerId = url.searchParams.get("registerId");
  const specialistSubjectId = url.searchParams.get("specialistSubjectId");

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
    const specialistContextSubject =
      specialistSubjectId && specialistSubjectId !== subjectId
        ? await getGradebookSubjectById(specialistSubjectId)
        : subject;
    const infoOnly = subject?.slug === "student-pastoral";
    const specialistRegisterSubject =
      isSpecialistGradebookSubject(subject) ? subject : specialistContextSubject;
    const usesSpecialistRegisters = Boolean(
      preview?.activeProfile && isSpecialistGradebookSubject(specialistRegisterSubject)
    );
    let specialistRegisters: SpecialistRegister[] = [];
    let activeRegisterId: string | null = null;
    let students: StudentRow[] = [];

    if (usesSpecialistRegisters && preview?.activeProfile) {
      specialistRegisters = await getSpecialistRegisters({
        staffProfileId: preview.activeProfile.id,
        subjectId: specialistRegisterSubject?.id ?? subjectId
      });

      const resolvedRegisterId =
        (registerId && specialistRegisters.some((register) => register.id === registerId) ? registerId : null) ??
        specialistRegisters[0]?.id ??
        null;

      if (resolvedRegisterId) {
        const detail = await getSpecialistRegisterDetail({
          registerId: resolvedRegisterId,
          staffProfileId: preview.activeProfile.id
        });

        if (detail) {
          const registerStudentIds = detail.students.map((student) => student.student_school_id);
          const registerStudentOrder = new Map(
            detail.students.map((student, index) => [student.student_school_id, index])
          );
          const specialistFilters = {
            ...filters,
            className: "",
            yearGroup: detail.register.year_group
          };
          const studentPool = preview
            ? filterStudentsForAccess(await getStudents(specialistFilters), preview.activeAccess)
            : await getStudents(specialistFilters);

          students = studentPool
            .filter((student) => registerStudentIds.includes(student.school_id))
            .sort(
              (left, right) =>
                (registerStudentOrder.get(left.school_id) ?? 0) - (registerStudentOrder.get(right.school_id) ?? 0)
            );
          activeRegisterId = resolvedRegisterId;
        } else {
          students = [];
        }
      } else {
        students = [];
      }
    } else {
      students = preview ? filterStudentsForAccess(await getStudents(filters), preview.activeAccess) : await getStudents(filters);
    }
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

    return NextResponse.json({
      students,
      fields,
      entries,
      subject,
      classOptions,
      assessments,
      terms,
      specialistRegisters,
      activeRegisterId,
      usesSpecialistRegisters: usesSpecialistRegisters && specialistRegisters.length > 0
    });
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
