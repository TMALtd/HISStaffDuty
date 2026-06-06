import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { getTimetableAdminData, getTimetablePreviewStaffOptions } from "@/lib/data";
import { filterTimetableClassesForAccess } from "@/lib/access";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableAdmin } from "@/components/timetable-admin";
import type {
  TimetableClassSummary,
  TimetablePreviewStaffOption,
  TimetableTemplate
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TimetablesPageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function TimetablesPage({ searchParams }: TimetablesPageProps) {
  const session = await requirePortalAccess("timetables");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  let classes: TimetableClassSummary[] = [];
  let templates: TimetableTemplate[] = [];
  let setupMessage: string | null = null;
  let previewOptions: TimetablePreviewStaffOption[] = [];

  try {
    const [data, staffOptions] = await Promise.all([
      getTimetableAdminData(),
      access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([])
    ]);
    classes = data.classes;
    templates = data.templates;
    setupMessage = data.setupMessage;
    previewOptions = staffOptions;
  } catch (error) {
    setupMessage =
      error instanceof Error
        ? `Timetables could not be loaded right now. ${error.message}`
        : "Timetables could not be loaded right now.";
  }

  classes = filterTimetableClassesForAccess(classes, preview.activeAccess);

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
      <TimetableAdmin
        initialClasses={classes}
        templates={templates}
        setupMessage={setupMessage}
        canManageClasses={access.isFullAccess && !preview.isPreviewing}
      />
    </main>
  );
}
