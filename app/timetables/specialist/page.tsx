import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { getSpecialistTimetableView, getTimetablePreviewStaffOptions } from "@/lib/data";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SpecialistTimetableView } from "@/components/specialist-timetable-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SpecialistTimetablePageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function SpecialistTimetablePage({ searchParams }: SpecialistTimetablePageProps) {
  const session = await requirePortalAccess("timetables");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const previewOptions = access.isFullAccess ? await getTimetablePreviewStaffOptions() : [];
  const schedule = await getSpecialistTimetableView({
    staffProfileId: preview.activeProfile?.id ?? "",
    staffName: preview.activeProfile?.first_name ?? preview.activeProfile?.name ?? null
  });
  const backHref = preview.previewEmail
    ? `/timetables?viewAs=${encodeURIComponent(preview.previewEmail)}`
    : "/timetables";

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
          {preview.isPreviewing ? (
            <p className="meta">
              Viewing as {preview.activeProfile?.name ?? preview.previewEmail} ({preview.activeAccess.roleLabel})
            </p>
          ) : null}
        </div>
        {access.isFullAccess ? (
          <AccessPreviewSwitcher options={previewOptions} selectedEmail={preview.previewEmail} />
        ) : null}
        <SignOutButton />
      </section>
      <PortalNav allowedViews={preview.activeAccess.allowedViews} />
      <SpecialistTimetableView data={schedule} backHref={backHref} />
    </main>
  );
}
