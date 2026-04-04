import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { DutyRoster } from "@/components/duty-roster";
import { requireStaffProfile } from "@/lib/auth";
import { getDutyRosterData } from "@/lib/data";

export default async function DutyRosterPage() {
  const { user, staffProfile } = await requireStaffProfile();
  const duties = await getDutyRosterData();

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">
            Signed in as {staffProfile?.name ?? user.email ?? "staff user"}
          </p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav />
      <DutyRoster duties={duties} />
    </main>
  );
}
