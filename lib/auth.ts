import { redirect } from "next/navigation";
import type { StaffProfile } from "@/lib/types";
import { getStaffProfileByEmail } from "@/lib/data";
import { canAccessView, getStaffAccess, type PortalView, type StaffAccess } from "@/lib/access";
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

type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

export type StaffAccessSession = {
  user: CurrentUser;
  staffProfile: StaffProfile | null;
  access: StaffAccess;
};

export type AccessPreviewSession = {
  activeProfile: StaffProfile | null;
  activeAccess: StaffAccess;
  previewEmail: string | null;
  isPreviewing: boolean;
};

async function buildStaffAccessSession(user: CurrentUser): Promise<StaffAccessSession> {
  const email = user.email ?? "";
  const staffProfile = email ? await getStaffProfileByEmail(email) : null;

  return {
    user,
    staffProfile,
    access: getStaffAccess(staffProfile, email)
  };
}

export async function getCurrentStaffAccessOrNull(): Promise<StaffAccessSession | null> {
  const user = await getCurrentUserOrNull();

  if (!user) {
    return null;
  }

  return buildStaffAccessSession(user);
}

export async function requireStaffAccess(): Promise<StaffAccessSession> {
  const user = await requireUser();
  return buildStaffAccessSession(user);
}

export async function requirePortalAccess(view: PortalView): Promise<StaffAccessSession> {
  const session = await requireStaffAccess();

  if (!canAccessView(session.access, view)) {
    redirect("/timetables");
  }

  return session;
}

export async function getAccessPreviewSession(
  session: StaffAccessSession,
  previewEmail: string | null | undefined
): Promise<AccessPreviewSession> {
  const normalizedPreviewEmail = (previewEmail ?? "").trim().toLowerCase();

  if (!session.access.isFullAccess || !normalizedPreviewEmail) {
    return {
      activeProfile: session.staffProfile,
      activeAccess: session.access,
      previewEmail: null,
      isPreviewing: false
    };
  }

  const previewProfile = await getStaffProfileByEmail(normalizedPreviewEmail);

  if (!previewProfile) {
    return {
      activeProfile: session.staffProfile,
      activeAccess: session.access,
      previewEmail: null,
      isPreviewing: false
    };
  }

  return {
    activeProfile: previewProfile,
    activeAccess: getStaffAccess(previewProfile, previewProfile.email),
    previewEmail: normalizedPreviewEmail,
    isPreviewing: true
  };
}

export async function requireStaffProfile(): Promise<{
  user: Awaited<ReturnType<typeof requireUser>>;
  staffProfile: StaffProfile | null;
}> {
  const { user, staffProfile } = await requireStaffAccess();

  return { user, staffProfile };
}

export function isTimetableAdminEmail(email: string | null | undefined) {
  return getStaffAccess(null, email).isFullAccess;
}
