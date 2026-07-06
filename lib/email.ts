import "server-only";

import nodemailer from "nodemailer";

export type EmailSenderKey = "workspace" | "duties";

export type EmailSenderOption = {
  key: EmailSenderKey;
  label: string;
  fromName: string;
  fromEmail: string;
};

type EmailSenderConfig = EmailSenderOption & {
  transport:
    | {
        type: "smtp";
        smtpUser: string;
        smtpPass: string;
      }
    | {
        type: "gmail-oauth";
        clientId: string;
        clientSecret: string;
        refreshToken: string;
      };
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function smtpHost() {
  return env("EMAIL_SMTP_HOST") || "smtp.gmail.com";
}

function smtpPort() {
  const raw = env("EMAIL_SMTP_PORT") || "465";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 465;
}

function smtpSecure() {
  const raw = (env("EMAIL_SMTP_SECURE") || "true").toLowerCase();
  return raw !== "false";
}

function configuredSenders(): EmailSenderConfig[] {
  const senders: EmailSenderConfig[] = [];

  const oauthSenderEmail = env("GOOGLE_OAUTH_SENDER_EMAIL");
  const oauthClientId = env("GOOGLE_OAUTH_CLIENT_ID");
  const oauthClientSecret = env("GOOGLE_OAUTH_CLIENT_SECRET");
  const oauthRefreshToken = env("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (oauthSenderEmail && oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const oauthSenderName = env("GOOGLE_OAUTH_SENDER_NAME") || "Workspace Email";
    senders.push({
      key: "workspace",
      label: oauthSenderName,
      fromName: oauthSenderName,
      fromEmail: oauthSenderEmail,
      transport: {
        type: "gmail-oauth",
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: oauthRefreshToken
      }
    });
  }

  const workspaceAddress = env("HIS_EMAIL_WORKSPACE_ADDRESS");
  const workspaceUser = env("HIS_EMAIL_WORKSPACE_SMTP_USER") || workspaceAddress;
  const workspacePass = env("HIS_EMAIL_WORKSPACE_SMTP_PASS");
  if (workspaceAddress && workspaceUser && workspacePass && !senders.some((sender) => sender.key === "workspace")) {
    senders.push({
      key: "workspace",
      label: env("HIS_EMAIL_WORKSPACE_NAME") || "HIS Staff Workspace",
      fromName: env("HIS_EMAIL_WORKSPACE_NAME") || "HIS Staff Workspace",
      fromEmail: workspaceAddress,
      transport: {
        type: "smtp",
        smtpUser: workspaceUser,
        smtpPass: workspacePass
      }
    });
  }

  const dutiesAddress = env("HIS_EMAIL_DUTIES_ADDRESS");
  const dutiesUser = env("HIS_EMAIL_DUTIES_SMTP_USER") || dutiesAddress;
  const dutiesPass = env("HIS_EMAIL_DUTIES_SMTP_PASS");
  if (dutiesAddress && dutiesUser && dutiesPass) {
    senders.push({
      key: "duties",
      label: env("HIS_EMAIL_DUTIES_NAME") || "HIS Staff Duties",
      fromName: env("HIS_EMAIL_DUTIES_NAME") || "HIS Staff Duties",
      fromEmail: dutiesAddress,
      transport: {
        type: "smtp",
        smtpUser: dutiesUser,
        smtpPass: dutiesPass
      }
    });
  }

  return senders;
}

export function getConfiguredEmailSenderOptions(): EmailSenderOption[] {
  return configuredSenders().map(({ key, label, fromName, fromEmail }) => ({
    key,
    label,
    fromName,
    fromEmail
  }));
}

function getSenderConfig(key: EmailSenderKey): EmailSenderConfig {
  const sender = configuredSenders().find((option) => option.key === key) ?? null;

  if (!sender) {
    throw new Error("This email sender is not configured yet in Render environment variables.");
  }

  return sender;
}

function normalizeRecipients(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function plainTextToHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken(sender: Extract<EmailSenderConfig["transport"], { type: "gmail-oauth" }>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: sender.clientId,
      client_secret: sender.clientSecret,
      refresh_token: sender.refreshToken,
      grant_type: "refresh_token"
    }).toString(),
    cache: "no-store"
  });

  const result = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || result.error || "Unable to refresh Google OAuth access token.");
  }

  return result.access_token;
}

async function sendViaGmailApi(input: {
  sender: EmailSenderConfig;
  recipients: string[];
  subject: string;
  message: string;
  replyTo: string;
}) {
  if (input.sender.transport.type !== "gmail-oauth") {
    throw new Error("Google OAuth sender is not configured correctly.");
  }

  const accessToken = await getGoogleAccessToken(input.sender.transport);
  const rawMessage = [
    `From: "${input.sender.fromName}" <${input.sender.fromEmail}>`,
    `To: ${input.recipients.join(", ")}`,
    `Reply-To: ${input.replyTo}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${plainTextToHtml(
      input.message
    )}</div>`
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: encodeBase64Url(rawMessage)
    }),
    cache: "no-store"
  });

  const result = (await response.json()) as {
    id?: string;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(result.error?.message || "Unable to send email through Gmail API.");
  }

  return result.id ?? null;
}

export async function sendGoogleWorkspaceEmail(input: {
  senderKey: EmailSenderKey;
  to: string;
  subject: string;
  message: string;
  replyTo?: string | null;
}) {
  const sender = getSenderConfig(input.senderKey);
  const recipients = normalizeRecipients(input.to);
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!recipients.length) {
    throw new Error("Add at least one recipient email address.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!message) {
    throw new Error("Email message is required.");
  }

  const replyTo = input.replyTo?.trim() || sender.fromEmail;

  if (sender.transport.type === "gmail-oauth") {
    await sendViaGmailApi({
      sender,
      recipients,
      subject,
      message,
      replyTo
    });
  } else {
    const transporter = nodemailer.createTransport({
      host: smtpHost(),
      port: smtpPort(),
      secure: smtpSecure(),
      auth: {
        user: sender.transport.smtpUser,
        pass: sender.transport.smtpPass
      }
    });

    await transporter.sendMail({
      from: `"${sender.fromName}" <${sender.fromEmail}>`,
      to: recipients.join(", "),
      replyTo,
      subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${plainTextToHtml(
        message
      )}</div>`
    });
  }

  return {
    senderLabel: sender.label,
    senderEmail: sender.fromEmail,
    recipients
  };
}
