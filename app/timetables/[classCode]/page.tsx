import { redirect } from "next/navigation";
import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { getTimetableBuilderData, getTimetablePreviewStaffOptions } from "@/lib/data";
import { canAccessTimetableClass, canEditTimetableClass } from "@/lib/access";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableBuilder } from "@/components/timetable-builder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TimetableBuilderPageProps = {
  params: {
    classCode: string;
  };
  searchParams?: {
    viewAs?: string;
  };
};

export default async function TimetableBuilderPage({ params, searchParams }: TimetableBuilderPageProps) {
  const session = await requirePortalAccess("timetables");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const data = await getTimetableBuilderData(decodeURIComponent(params.classCode));
  const previewOptions = access.isFullAccess ? await getTimetablePreviewStaffOptions() : [];
  const canEdit =
    !preview.isPreviewing && canEditTimetableClass(preview.activeAccess, data.classSummary);

  if (!canAccessTimetableClass(preview.activeAccess, data.classSummary)) {
    redirect(preview.previewEmail ? `/timetables?viewAs=${encodeURIComponent(preview.previewEmail)}` : "/timetables");
  }

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
      <TimetableBuilder initialData={data} isReadOnly={!canEdit} />
    </main>
  );
}
