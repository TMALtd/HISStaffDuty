import { NextResponse } from "next/server";
import { createGradebookFieldDefinition, getGradebookFieldDefinitions } from "@/lib/data";
import { getCurrentUserOrNull } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subjectId = new URL(request.url).searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required." }, { status: 400 });
  }

  try {
    const fields = await getGradebookFieldDefinitions(subjectId);
    return NextResponse.json({ fields });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load field definitions." },
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
    const field = await createGradebookFieldDefinition({
      subjectId: body.subjectId,
      fieldLabel: body.fieldLabel,
      fieldType: body.fieldType,
      isRequired: Boolean(body.isRequired)
    });

    return NextResponse.json({ field });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create custom field." },
      { status: 500 }
    );
  }
}
