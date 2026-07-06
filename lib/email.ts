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
  smtpUser: string;
  smtpPass: string;
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

  const workspaceAddress = env("HIS_EMAIL_WORKSPACE_ADDRESS");
  const workspaceUser = env("HIS_EMAIL_WORKSPACE_SMTP_USER") || workspaceAddress;
  const workspacePass = env("HIS_EMAIL_WORKSPACE_SMTP_PASS");
  if (workspaceAddress && workspaceUser && workspacePass) {
    senders.push({
      key: "workspace",
      label: env("HIS_EMAIL_WORKSPACE_NAME") || "HIS Staff Workspace",
      fromName: env("HIS_EMAIL_WORKSPACE_NAME") || "HIS Staff Workspace",
      fromEmail: workspaceAddress,
      smtpUser: workspaceUser,
      smtpPass: workspacePass
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
      smtpUser: dutiesUser,
      smtpPass: dutiesPass
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

  const transporter = nodemailer.createTransport({
    host: smtpHost(),
    port: smtpPort(),
    secure: smtpSecure(),
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass
    }
  });

  await transporter.sendMail({
    from: `"${sender.fromName}" <${sender.fromEmail}>`,
    to: recipients.join(", "),
    replyTo: input.replyTo?.trim() || sender.fromEmail,
    subject,
    text: message,
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${plainTextToHtml(
      message
    )}</div>`
  });

  return {
    senderLabel: sender.label,
    senderEmail: sender.fromEmail,
    recipients
  };
}
