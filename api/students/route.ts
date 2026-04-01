import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getStudents } from "@/lib/data";
import { toQueryFilters } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filters = toQueryFilters(new URL(request.url).searchParams);
    const students = await getStudents(filters);
    return NextResponse.json({ students });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load students." },
      { status: 500 }
    );
  }
}
