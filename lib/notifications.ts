import "server-only";

import webpush from "web-push";
import type { NotificationRecipientMode } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const PUSH_SUBSCRIPTIONS_TABLE = "web_push_subscriptions";

type PushSubscriptionRecord = {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  staff_email: string | null;
  staff_name: string | null;
  team_label: string | null;
  user_agent: string | null;
};

type BrowserPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getNotificationConfig() {
  return {
    publicKey: env("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    privateKey: env("VAPID_PRIVATE_KEY"),
    subject: env("VAPID_SUBJECT")
  };
}

export function getPushNotificationSetupStatus() {
  const config = getNotificationConfig();

  return {
    isConfigured: Boolean(config.publicKey && config.privateKey && config.subject),
    publicKey: config.publicKey
  };
}

function ensurePushConfig() {
  const config = getNotificationConfig();

  if (!config.publicKey || !config.privateKey || !config.subject) {
    throw new Error(
      "Push notifications are not configured yet. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in Render."
    );
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export async function savePushSubscription(input: {
  subscription: BrowserPushSubscription;
  staffEmail: string | null;
  staffName: string | null;
  teamLabel: string | null;
  userAgent: string | null;
}) {
  ensurePushConfig();

  const endpoint = normalizeText(input.subscription.endpoint);
  const p256dhKey = normalizeText(input.subscription.keys?.p256dh);
  const authKey = normalizeText(input.subscription.keys?.auth);

  if (!endpoint || !p256dhKey || !authKey) {
    throw new Error("Browser push subscription is incomplete.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(PUSH_SUBSCRIPTIONS_TABLE).upsert(
    {
      endpoint,
      p256dh_key: p256dhKey,
      auth_key: authKey,
      staff_email: normalizeEmail(input.staffEmail),
      staff_name: normalizeText(input.staffName),
      team_label: normalizeText(input.teamLabel),
      user_agent: normalizeText(input.userAgent),
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "endpoint"
    }
  );

  if (error) {
    if (error.message.includes(PUSH_SUBSCRIPTIONS_TABLE)) {
      throw new Error(
        "Push subscriptions table is not set up yet. Run supabase_web_push_subscriptions.sql first."
      );
    }

    throw new Error(error.message);
  }
}

export async function removePushSubscription(endpoint: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(PUSH_SUBSCRIPTIONS_TABLE)
    .delete()
    .eq("endpoint", normalizeText(endpoint));

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendDesktopNotification(input: {
  title: string;
  message: string;
  url?: string | null;
  recipientMode: NotificationRecipientMode;
  selectedEmails?: string[];
  selectedTeam?: string | null;
}) {
  ensurePushConfig();

  const title = String(input.title ?? "").trim();
  const message = String(input.message ?? "").trim();
  const url = normalizeText(input.url);

  if (!title) {
    throw new Error("Notification title is required.");
  }

  if (!message) {
    throw new Error("Notification message is required.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(PUSH_SUBSCRIPTIONS_TABLE)
    .select("endpoint,p256dh_key,auth_key,staff_email,staff_name,team_label,user_agent");

  if (error) {
    if (error.message.includes(PUSH_SUBSCRIPTIONS_TABLE)) {
      throw new Error(
        "Push subscriptions table is not set up yet. Run supabase_web_push_subscriptions.sql first."
      );
    }

    throw new Error(error.message);
  }

  const subscriptions = ((data ?? []) as PushSubscriptionRecord[]).filter((record) => {
    if (input.recipientMode === "all") {
      return true;
    }

    if (input.recipientMode === "team") {
      return normalizeText(record.team_label) === normalizeText(input.selectedTeam);
    }

    const selectedEmailSet = new Set((input.selectedEmails ?? []).map((email) => email.trim().toLowerCase()));
    return record.staff_email ? selectedEmailSet.has(record.staff_email.trim().toLowerCase()) : false;
  });

  if (!subscriptions.length) {
    throw new Error("No subscribed browsers match the selected notification recipients.");
  }

  const payload = JSON.stringify({
    title,
    body: message,
    url: url || "/",
    icon: "/help-international-school-logo.png",
    badge: "/help-international-school-logo.png"
  });

  const failedEndpoints: string[] = [];
  let sentCount = 0;

  await Promise.all(
    subscriptions.map(async (record) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: record.endpoint,
            keys: {
              p256dh: record.p256dh_key,
              auth: record.auth_key
            }
          },
          payload
        );
        sentCount += 1;
      } catch (error) {
        failedEndpoints.push(record.endpoint);
        const statusCode =
          typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(record.endpoint);
        }
      }
    })
  );

  return {
    matchedCount: subscriptions.length,
    sentCount,
    failedCount: failedEndpoints.length
  };
}
