import Link from "next/link";
import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import {
  getPortalHeroSettings,
  getTimetableAdminData,
  getTimetablePreviewStaffOptions
} from "@/lib/data";
import { filterTimetableClassesForAccess } from "@/lib/access";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableAdmin } from "@/components/timetable-admin";
import type {
  PortalHeroSettings,
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
  let activeHero: PortalHeroSettings | null = null;

  try {
    const [data, staffOptions, heroSettings] = await Promise.all([
      getTimetableAdminData(),
      access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
      getPortalHeroSettings()
    ]);
    classes = data.classes;
    templates = data.templates;
    setupMessage = data.setupMessage;
    previewOptions = staffOptions;
    activeHero =
      heroSettings.find((setting) =>
        setting.pageKey === (access.isFullAccess && !preview.isPreviewing ? "timetables-admin" : "timetables-view")
      ) ?? null;
  } catch (error) {
    setupMessage =
      error instanceof Error
        ? `Timetables could not be loaded right now. ${error.message}`
        : "Timetables could not be loaded right now.";
  }

  classes = filterTimetableClassesForAccess(classes, preview.activeAccess);
  const specialistScheduleHref = preview.previewEmail
    ? `/timetables/specialist?viewAs=${encodeURIComponent(preview.previewEmail)}`
    : "/timetables/specialist";

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
      {preview.activeProfile ? (
        <section className="panel specialist-launch-panel">
          <div>
            <p className="eyebrow">Specialist teachers</p>
            <h2 className="panel-title">View the specialist teaching timetable</h2>
            <p className="hero-copy specialist-launch-copy">
              See which year group this teacher is teaching in each lesson block, along with the
              classes they are covering during that time.
            </p>
          </div>
          <div className="actions">
            <Link className="button" href={specialistScheduleHref}>
              Open Specialist Timetable
            </Link>
          </div>
        </section>
      ) : null}
      <TimetableAdmin
        initialClasses={classes}
        templates={templates}
        setupMessage={setupMessage}
        canManageClasses={access.isFullAccess && !preview.isPreviewing}
        heroSettings={activeHero}
      />
    </main>
  );
}
