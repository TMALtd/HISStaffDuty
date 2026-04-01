import { NextResponse } from "next/server";
import { getCurrentUserOrNull } from "@/lib/auth";
import { getFilterOptions } from "@/lib/data";
import { toQueryFilters } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUserOrNull();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filters = toQueryFilters(new URL(request.url).searchParams);
    const options = await getFilterOptions(filters);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load filters." },
      { status: 500 }
    );
  }
}
