"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EmailRecipientOption } from "@/lib/types";

type EmailSenderOption = {
  key: "workspace" | "duties";
  label: string;
  fromName: string;
  fromEmail: string;
};

type EmailDeliveryPanelProps = {
  senderOptions: EmailSenderOption[];
  recipientOptions: EmailRecipientOption[];
  defaultRecipient?: string;
};

type RecipientMode = "individual" | "team" | "all";

type EmailTemplateKey =
  | "new-user-login"
  | "personal-details-update"
  | "timetable-change"
  | "student-list-timetable"
  | "all-users-notification"
  | "duty-swap";

type EmailTemplate = {
  key: EmailTemplateKey;
  label: string;
  subject: (senderLabel: string) => string;
  message: (senderLabel: string) => string;
};

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: "new-user-login",
    label: "New User Login Email",
    subject: () => "Your HELP Staff Workspace login details",
    message: (senderLabel) => `Hello [Staff Name],

Welcome to the HELP Staff Workspace.

Your account has now been set up and you can sign in using your school email address.

Please use the login page below:
[Login Link]

If you have any trouble accessing your account, please reply to this email for support.

Kind regards,
${senderLabel}`
  },
  {
    key: "personal-details-update",
    label: "Personal Details Update Email",
    subject: () => "Please review and update your staff details",
    message: (senderLabel) => `Hello [Staff Name],

Please review your personal details in the HELP Staff Workspace and update any information that is no longer correct.

Please check the following carefully:
- Full name
- Email address
- Extension
- Department
- Class or timetable access

If anything needs changing, please update it as soon as possible.

Kind regards,
${senderLabel}`
  },
  {
    key: "timetable-change",
    label: "Timetable Change Email",
    subject: () => "Timetable update for [Class / Year Group]",
    message: (senderLabel) => `Hello [Staff Name],

Please note that there has been a timetable change for [Class / Year Group].

Summary of change:
[Insert timetable change details]

Please review the updated timetable in the HELP Staff Workspace.

Kind regards,
${senderLabel}`
  },
  {
    key: "student-list-timetable",
    label: "Student List Timetable Email",
    subject: () => "Student list and timetable update for [Class / Group]",
    message: (senderLabel) => `Hello [Staff Name],

Please find the latest student list and timetable information for [Class / Group].

Included in this update:
- Student list
- Timetable details
- Any recent class changes

Please review the information and let us know if anything needs correcting.

Kind regards,
${senderLabel}`
  },
  {
    key: "all-users-notification",
    label: "All Users Notification Email",
    subject: () => "Important update from HELP Staff Workspace",
    message: (senderLabel) => `Hello everyone,

Please note the following important update:

[Insert announcement or message here]

Please read this carefully and take any required action.

Kind regards,
${senderLabel}`
  },
  {
    key: "duty-swap",
    label: "Duty Swap Email",
    subject: () => "Duty swap request for [Date / Duty Name]",
    message: (senderLabel) => `Hello [Staff Name],

This is a duty swap request for:
[Duty Name]
[Date and Time]

Requested change:
[Insert details of the swap]

Please confirm whether you are able to cover this duty.

Kind regards,
${senderLabel}`
  }
];

function getTemplateByKey(templateKey: EmailTemplateKey) {
  return EMAIL_TEMPLATES.find((template) => template.key === templateKey) ?? EMAIL_TEMPLATES[0];
}

function getEmailPreset(templateKey: EmailTemplateKey, senderLabel: string) {
  const template = getTemplateByKey(templateKey);

  return {
    subject: template.subject(senderLabel),
    message: template.message(senderLabel)
  };
}

export function EmailDeliveryPanel({
  senderOptions,
  recipientOptions,
  defaultRecipient = ""
}: EmailDeliveryPanelProps) {
  const initialTemplateKey: EmailTemplateKey = "new-user-login";
  const initialSenderKey = senderOptions[0]?.key ?? "workspace";
  const initialSenderLabel =
    senderOptions.find((option) => option.key === initialSenderKey)?.fromName ?? "HELP International School";
  const initialPreset = getEmailPreset(initialTemplateKey, initialSenderLabel);
  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>(initialTemplateKey);
  const [senderKey, setSenderKey] = useState(initialSenderKey);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("individual");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>(defaultRecipient ? [defaultRecipient] : []);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [to, setTo] = useState(defaultRecipient);
  const [subject, setSubject] = useState(initialPreset.subject);
  const [message, setMessage] = useState(initialPreset.message);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const teamOptions = useMemo(
    () =>
      Array.from(new Set(recipientOptions.map((option) => option.teamLabel).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      ),
    [recipientOptions]
  );

  const visibleRecipientOptions = useMemo(() => {
    const search = recipientSearch.trim().toLowerCase();

    return recipientOptions.filter((option) => {
      if (!search) {
        return true;
      }

      return [option.name, option.email, option.teamLabel]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [recipientOptions, recipientSearch]);

  const autoRecipients = useMemo(() => {
    if (recipientMode === "all") {
      return recipientOptions.map((option) => option.email);
    }

    if (recipientMode === "team") {
      return recipientOptions
        .filter((option) => option.teamLabel === selectedTeam)
        .map((option) => option.email);
    }

    return selectedEmails;
  }, [recipientMode, recipientOptions, selectedEmails, selectedTeam]);

  useEffect(() => {
    setTo(autoRecipients.join(", "));
  }, [autoRecipients]);

  function handleSenderChange(nextSenderKey: EmailSenderOption["key"]) {
    const currentSenderLabel =
      senderOptions.find((option) => option.key === senderKey)?.fromName ?? "HELP International School";
    const nextSenderLabel =
      senderOptions.find((option) => option.key === nextSenderKey)?.fromName ?? "HELP International School";
    const currentPreset = getEmailPreset(templateKey, currentSenderLabel);
    const nextPreset = getEmailPreset(templateKey, nextSenderLabel);

    setSenderKey(nextSenderKey);

    if (!subject.trim() || subject === currentPreset.subject) {
      setSubject(nextPreset.subject);
    }

    if (!message.trim() || message === currentPreset.message) {
      setMessage(nextPreset.message);
    }
  }

  function handleTemplateChange(nextTemplateKey: EmailTemplateKey) {
    const currentSenderLabel =
      senderOptions.find((option) => option.key === senderKey)?.fromName ?? "HELP International School";
    const nextPreset = getEmailPreset(nextTemplateKey, currentSenderLabel);

    setTemplateKey(nextTemplateKey);
    setSubject(nextPreset.subject);
    setMessage(nextPreset.message);
  }

  function toggleIndividualRecipient(email: string) {
    setSelectedEmails((current) =>
      current.includes(email) ? current.filter((entry) => entry !== email) : [...current, email]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          senderKey,
          to,
          subject,
          message
        })
      });

      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to send email.");
      }

      setStatus(result.message ?? "Email sent.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send email.");
    } finally {
      setIsSending(false);
    }
  }

  if (!senderOptions.length) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Email Delivery</p>
            <h2 className="panel-title">Email delivery is not configured yet</h2>
          </div>
        </div>
        <div className="status-banner error">
          Add at least one sender configuration in Render before sending email from the app.
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Email Delivery</p>
          <h2 className="panel-title">Send email from the workspace</h2>
        </div>
        <p className="hint">Choose a configured sender, then tailor the subject and message before sending.</p>
      </div>

      <form className="directory-search-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="recipientMode">Recipients</label>
          <select
            id="recipientMode"
            value={recipientMode}
            onChange={(event) => setRecipientMode(event.target.value as RecipientMode)}
          >
            <option value="individual">Select individuals</option>
            <option value="team">Select a team</option>
            <option value="all">All users</option>
          </select>
        </div>

        {recipientMode === "team" ? (
          <div className="field">
            <label htmlFor="recipientTeam">Team</label>
            <select
              id="recipientTeam"
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
            >
              <option value="">Choose team</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="emailTemplate">Template</label>
          <select
            id="emailTemplate"
            value={templateKey}
            onChange={(event) => handleTemplateChange(event.target.value as EmailTemplateKey)}
          >
            {EMAIL_TEMPLATES.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="senderKey">Sender</label>
          <select
            id="senderKey"
            value={senderKey}
            onChange={(event) => handleSenderChange(event.target.value as EmailSenderOption["key"])}
          >
            {senderOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} ({option.fromEmail})
              </option>
            ))}
          </select>
        </div>

        <div className="field directory-search-field">
          <label htmlFor="emailTo">To</label>
          <input
            id="emailTo"
            type="text"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="recipient@school.edu"
          />
        </div>

        <div className="field directory-search-field">
          <label htmlFor="emailSubject">Subject</label>
          <input
            id="emailSubject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div className="field field-span-3">
          <label htmlFor="emailMessage">Message</label>
          <textarea
            id="emailMessage"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
          />
        </div>

        {recipientMode === "individual" ? (
          <div className="field field-span-3">
            <label htmlFor="recipientSearch">Choose staff recipients</label>
            <input
              id="recipientSearch"
              type="text"
              value={recipientSearch}
              onChange={(event) => setRecipientSearch(event.target.value)}
              placeholder="Search by name, email, or team"
            />
            <div className="email-recipient-list">
              {visibleRecipientOptions.map((option) => {
                const isSelected = selectedEmails.includes(option.email);

                return (
                  <label key={option.email} className="email-recipient-option">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleIndividualRecipient(option.email)}
                    />
                    <span>
                      <strong>{option.name}</strong>
                      <small>
                        {option.email} | {option.teamLabel}
                      </small>
                    </span>
                  </label>
                );
              })}
              {!visibleRecipientOptions.length ? <p className="hint">No matching staff found.</p> : null}
            </div>
          </div>
        ) : null}

        {recipientMode === "all" ? (
          <div className="field field-span-3">
            <p className="hint">
              This will send to all configured staff recipients: <strong>{recipientOptions.length}</strong>
            </p>
          </div>
        ) : null}

        <div className="actions">
          <button className="button" type="submit" disabled={isSending}>
            {isSending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </form>

      <p className="hint">
        You can use placeholders such as `[Staff Name]`, `[Login Link]`, `[Class / Group]`, `[Duty Name]`, and
        replace them before sending.
      </p>

      {status ? <div className="status-banner success">{status}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
    </section>
  );
}
