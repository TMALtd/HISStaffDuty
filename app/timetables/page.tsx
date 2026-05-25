import { requireUser } from "@/lib/auth";
import { getTimetableAdminData } from "@/lib/data";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableAdmin } from "@/components/timetable-admin";
import type { TimetableClassSummary, TimetableTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TimetablesPage() {
  const user = await requireUser();
  let classes: TimetableClassSummary[] = [];
  let templates: TimetableTemplate[] = [];
  let setupMessage: string | null = null;

  try {
    const data = await getTimetableAdminData();
    classes = data.classes;
    templates = data.templates;
    setupMessage = data.setupMessage;
  } catch (error) {
    setupMessage =
      error instanceof Error
        ? `Timetables could not be loaded right now. ${error.message}`
        : "Timetables could not be loaded right now.";
  }

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav />
      <TimetableAdmin initialClasses={classes} templates={templates} setupMessage={setupMessage} />
    </main>
  );
}
