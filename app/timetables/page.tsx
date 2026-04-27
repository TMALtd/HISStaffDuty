import { requireUser } from "@/lib/auth";
import { getTimetableClassSummaries, getTimetableTemplates } from "@/lib/data";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableAdmin } from "@/components/timetable-admin";

export default async function TimetablesPage() {
  const user = await requireUser();
  const [classes, templates] = await Promise.all([
    getTimetableClassSummaries(),
    getTimetableTemplates()
  ]);

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
      <TimetableAdmin initialClasses={classes} templates={templates} />
    </main>
  );
}
