import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getGradebookAssessments } from "@/lib/data";

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
