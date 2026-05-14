import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { bulkImportSpecialistCsv } from "@/lib/data";

export async function POST(request: Request) {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await bulkImportSpecialistCsv({
      csvText: String(body.csvText ?? "")
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import specialist CSV." },
      { status: 500 }
    );
  }
}
