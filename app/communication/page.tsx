import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { DesktopNotificationPanel } from "@/components/desktop-notification-panel";
import { EmailDeliveryPanel } from "@/components/email-delivery-panel";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { getAccessPreviewSession, getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import { getEmailRecipientOptions, getTimetablePreviewStaffOptions } from "@/lib/data";
import { getConfiguredEmailSenderOptions } from "@/lib/email";
import { getPushNotificationSetupStatus } from "@/lib/notifications";

type CommunicationPageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function CommunicationPage({ searchParams }: CommunicationPageProps) {
  const session = await requirePortalAccess("communication");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const [previewOptions, recipientOptions, visibleViews] = await Promise.all([
    access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getEmailRecipientOptions() : Promise.resolve([]),
    getVisiblePortalViews(preview.activeAccess, access.isFullAccess && !preview.isPreviewing)
  ]);
  const senderOptions =
    access.isFullAccess && !preview.isPreviewing ? getConfiguredEmailSenderOptions() : [];
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
        <p className="eyebrow">Admin communications</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Communication</h1>
            <p className="hero-copy">
              Send staff emails and desktop notifications from one admin-only workspace.
            </p>
          </div>
        </div>
      </section>

      {access.isFullAccess && !preview.isPreviewing ? (
        <EmailDeliveryPanel
          senderOptions={senderOptions}
          recipientOptions={recipientOptions}
          defaultRecipient={user.email ?? ""}
        />
      ) : null}

      {pushSetup.isConfigured ? (
        <DesktopNotificationPanel
          recipientOptions={recipientOptions}
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
    </main>
  );
}
