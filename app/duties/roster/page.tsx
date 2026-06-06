import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { DutyRoster } from "@/components/duty-roster";
import { requirePortalAccess } from "@/lib/auth";
import { getDutyRosterViewData } from "@/lib/data";

export default async function DutyRosterPage() {
  const { user, staffProfile, access } = await requirePortalAccess("duty-roster");
  const data = await getDutyRosterViewData();

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
      <PortalNav allowedViews={access.allowedViews} />
      <DutyRoster data={data} />
    </main>
  );
}
