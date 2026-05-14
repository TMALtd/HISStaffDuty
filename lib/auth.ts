import { redirect } from "next/navigation";
import type { StaffProfile } from "@/lib/types";
import { getStaffProfileByEmail } from "@/lib/data";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUserOrNull() {
  if (!hasSupabaseBrowserEnv()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUserOrNull();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireStaffProfile(): Promise<{
  user: Awaited<ReturnType<typeof requireUser>>;
  staffProfile: StaffProfile | null;
}> {
  const user = await requireUser();
  const email = user.email ?? "";
  const staffProfile = email ? await getStaffProfileByEmail(email) : null;

  return { user, staffProfile };
}
