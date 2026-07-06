import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { PortalNav } from "@/components/portal-nav";
import { StaffDashboard } from "@/components/staff-dashboard";
import { SignOutButton } from "@/components/sign-out-button";
import { EmailDeliveryPanel } from "@/components/email-delivery-panel";
import { DesktopNotificationPanel } from "@/components/desktop-notification-panel";
import { PortalPageAccessPanel } from "@/components/portal-page-access-panel";
import {
  getEmailRecipientOptions,
  getPortalHeroSettings,
  getPortalPageAccessSettings,
  getStudentAcademicYears,
  getStudentRosterClassOptions,
  getTimetablePreviewStaffOptions
} from "@/lib/data";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { getVisiblePortalViews } from "@/lib/auth";
import { getConfiguredEmailSenderOptions } from "@/lib/email";
import { getPushNotificationSetupStatus } from "@/lib/notifications";

type HomePageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await requirePortalAccess("student-filter");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const [academicYears, classOptions, previewOptions, emailSenderOptions, emailRecipientOptions, pageAccessSettings, visibleViews] = await Promise.all([
    access.isFullAccess && !preview.isPreviewing ? getStudentAcademicYears() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getStudentRosterClassOptions() : Promise.resolve([]),
    access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing
      ? Promise.resolve(getConfiguredEmailSenderOptions())
      : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getEmailRecipientOptions() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getPortalPageAccessSettings() : Promise.resolve([]),
    getVisiblePortalViews(preview.activeAccess, access.isFullAccess && !preview.isPreviewing)
  ]);
  const heroSettings =
    (await getPortalHeroSettings()).find((setting) => setting.pageKey === "student-filter") ?? null;
  const pushSetup = getPushNotificationSetupStatus();

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
      <PortalNav allowedViews={visibleViews} />
      <section className="hero-card">
        <p className="eyebrow">{heroSettings?.eyebrow ?? "Render-ready staff workspace"}</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">{heroSettings?.title ?? "Student filter portal"}</h1>
            <p className="hero-copy">
              {heroSettings?.description ??
                "Narrow the roster from school all the way down to class, then review the matching students in one place."}
            </p>
          </div>
        </div>
      </section>
      {access.isFullAccess && !preview.isPreviewing ? (
        <EmailDeliveryPanel
          senderOptions={emailSenderOptions}
          recipientOptions={emailRecipientOptions}
          defaultRecipient={user.email ?? ""}
        />
      ) : null}
      {pushSetup.isConfigured ? (
        <DesktopNotificationPanel
          recipientOptions={emailRecipientOptions}
          vapidPublicKey={pushSetup.publicKey}
          canSendNotifications={access.isFullAccess && !preview.isPreviewing}
        />
      ) : access.isFullAccess && !preview.isPreviewing ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Desktop Notifications</p>
              <h2 className="panel-title">Push notifications are not configured yet</h2>
            </div>
          </div>
          <div className="status-banner error">
            Add NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in Render, then run
            `supabase_web_push_subscriptions.sql` in Supabase.
          </div>
        </section>
      ) : null}
      {access.isFullAccess && !preview.isPreviewing ? (
        <PortalPageAccessPanel initialSettings={pageAccessSettings} />
      ) : null}
      <StaffDashboard
        canManageRosterYears={access.isFullAccess && !preview.isPreviewing}
        academicYears={academicYears}
        classOptions={classOptions}
        previewEmail={preview.previewEmail}
      />
    </main>
  );
}
