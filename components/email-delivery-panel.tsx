"use client";

import { useState, type FormEvent } from "react";

type EmailSenderOption = {
  key: "workspace" | "duties";
  label: string;
  fromName: string;
  fromEmail: string;
};

type EmailDeliveryPanelProps = {
  senderOptions: EmailSenderOption[];
  defaultRecipient?: string;
};

export function EmailDeliveryPanel({
  senderOptions,
  defaultRecipient = ""
}: EmailDeliveryPanelProps) {
  const [senderKey, setSenderKey] = useState(senderOptions[0]?.key ?? "workspace");
  const [to, setTo] = useState(defaultRecipient);
  const [subject, setSubject] = useState("Workspace email test");
  const [message, setMessage] = useState(
    "This is a test email from the HELP staff workspace."
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

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
        <p className="hint">Choose a configured sender and send a test email directly from the app.</p>
      </div>

      <form className="directory-search-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="senderKey">Sender</label>
          <select
            id="senderKey"
            value={senderKey}
            onChange={(event) => setSenderKey(event.target.value as EmailSenderOption["key"])}
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

        <div className="actions">
          <button className="button" type="submit" disabled={isSending}>
            {isSending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </form>

      {status ? <div className="status-banner success">{status}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
    </section>
  );
}
