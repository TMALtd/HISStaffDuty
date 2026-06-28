import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { createGradebookAssessment, getGradebookAssessments } from "@/lib/data";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const className = url.searchParams.get("className") || undefined;

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required." }, { status: 400 });
  }

  try {
    const assessments = await getGradebookAssessments({ subjectId, className });
    return NextResponse.json({ assessments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load assessments." },
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
    const assessment = await createGradebookAssessment({
      subjectId: body.subjectId,
      className: body.className ?? null,
      assessmentName: body.assessmentName,
      assessmentDate: body.assessmentDate,
      maxScore: Number(body.maxScore)
    });
    return NextResponse.json({ assessment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save assessment." },
      { status: 400 }
    );
  }
}
