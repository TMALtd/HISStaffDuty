import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { StaffDirectory } from "@/components/staff-directory";
import { requireStaffProfile } from "@/lib/auth";
import { getStaffDirectoryData } from "@/lib/data";

export default async function DirectoryPage() {
  const { user, staffProfile } = await requireStaffProfile();
  const staff = await getStaffDirectoryData();

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
      <StaffDirectory staff={staff} />
    </main>
  );
}
