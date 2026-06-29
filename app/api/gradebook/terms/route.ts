import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getGradebookTerms, upsertGradebookTerms } from "@/lib/data";

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const terms = await getGradebookTerms();
    return NextResponse.json({ terms });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load markbook terms." },
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
    const terms = await upsertGradebookTerms(body.terms ?? []);
    return NextResponse.json({ terms });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save markbook terms." },
      { status: 400 }
    );
  }
}
