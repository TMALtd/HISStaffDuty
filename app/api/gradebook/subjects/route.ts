import { NextResponse } from "next/server";
import { createGradebookSubject, getGradebookSubjects } from "@/lib/data";
import { getCurrentUserOrNull } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const className = new URL(request.url).searchParams.get("className") || undefined;
    const subjects = await getGradebookSubjects(className);
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
