"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailRecipientOption, NotificationRecipientMode } from "@/lib/types";

type DesktopNotificationPanelProps = {
  recipientOptions: EmailRecipientOption[];
  vapidPublicKey: string;
  canSendNotifications?: boolean;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function DesktopNotificationPanel({
  recipientOptions,
  vapidPublicKey,
  canSendNotifications = false
}: DesktopNotificationPanelProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionEndpoint, setSubscriptionEndpoint] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [recipientMode, setRecipientMode] = useState<NotificationRecipientMode>("all");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [title, setTitle] = useState("HELP Staff Workspace");
  const [message, setMessage] = useState("You have a new staff notification.");
  const [url, setUrl] = useState("/");

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

      return [option.name, option.email, option.teamLabel].join(" ").toLowerCase().includes(search);
    });
  }, [recipientOptions, recipientSearch]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);

    if (!supported) {
      return;
    }

    setPermission(Notification.permission);

    async function loadSubscription() {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
      setSubscriptionEndpoint(subscription?.endpoint ?? "");
    }

    void loadSubscription();
  }, []);

  async function enableNotifications() {
    setStatus("");
    setError("");
    setIsWorking(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      setIsSubscribed(true);
      setSubscriptionEndpoint(subscription.endpoint);
      setStatus("Desktop notifications are enabled on this browser.");
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "Unable to enable notifications.");
    } finally {
      setIsWorking(false);
    }
  }

  async function disableNotifications() {
    setStatus("");
    setError("");
    setIsWorking(true);

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setSubscriptionEndpoint("");
      setStatus("Desktop notifications are disabled on this browser.");
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "Unable to disable notifications.");
    } finally {
      setIsWorking(false);
    }
  }

  function toggleEmail(email: string) {
    setSelectedEmails((current) =>
      current.includes(email) ? current.filter((entry) => entry !== email) : [...current, email]
    );
  }

  async function sendNotification() {
    setStatus("");
    setError("");
    setIsWorking(true);

    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          message,
          url,
          recipientMode,
          selectedEmails,
          selectedTeam
        })
      });

      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to send desktop notification.");
      }

      setStatus(result.message ?? "Desktop notification sent.");
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "Unable to send desktop notification.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Desktop Notifications</p>
          <h2 className="panel-title">Enable browser alerts and send live notifications</h2>
        </div>
        <p className="hint">
          Staff must enable notifications once in their browser before they can receive them.
        </p>
      </div>

      {!isSupported ? (
        <div className="status-banner error">
          This browser does not support desktop push notifications.
        </div>
      ) : (
        <>
          <div className="actions">
            <button className="button" type="button" onClick={enableNotifications} disabled={isWorking || isSubscribed}>
              {isSubscribed ? "Notifications Enabled" : "Enable Notifications"}
            </button>
            <button className="button secondary" type="button" onClick={disableNotifications} disabled={isWorking || !isSubscribed}>
              Turn Off Notifications
            </button>
          </div>
          <p className="hint">
            Permission: <strong>{permission}</strong>
            {subscriptionEndpoint ? " | This browser is subscribed." : ""}
          </p>
        </>
      )}

      {canSendNotifications ? (
        <div className="directory-search-grid">
          <div className="field">
            <label htmlFor="notificationRecipientMode">Recipients</label>
            <select
              id="notificationRecipientMode"
              value={recipientMode}
              onChange={(event) => setRecipientMode(event.target.value as NotificationRecipientMode)}
            >
              <option value="individual">Select individuals</option>
              <option value="team">Select a team</option>
              <option value="all">All subscribed users</option>
            </select>
          </div>

          {recipientMode === "team" ? (
            <div className="field">
              <label htmlFor="notificationTeam">Team</label>
              <select
                id="notificationTeam"
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

          <div className="field directory-search-field">
            <label htmlFor="notificationTitle">Title</label>
            <input id="notificationTitle" type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="field directory-search-field">
            <label htmlFor="notificationUrl">Open link</label>
            <input id="notificationUrl" type="text" value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>

          <div className="field field-span-3">
            <label htmlFor="notificationMessage">Message</label>
            <textarea
              id="notificationMessage"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
            />
          </div>

          {recipientMode === "individual" ? (
            <div className="field field-span-3">
              <label htmlFor="notificationRecipientSearch">Choose staff recipients</label>
              <input
                id="notificationRecipientSearch"
                type="text"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search by name, email, or team"
              />
              <div className="email-recipient-list">
                {visibleRecipientOptions.map((option) => (
                  <label key={option.email} className="email-recipient-option">
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(option.email)}
                      onChange={() => toggleEmail(option.email)}
                    />
                    <span>
                      <strong>{option.name}</strong>
                      <small>
                        {option.email} | {option.teamLabel}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="actions field-span-3">
            <button className="button" type="button" onClick={sendNotification} disabled={isWorking}>
              {isWorking ? "Sending..." : "Send Desktop Notification"}
            </button>
          </div>
        </div>
      ) : null}

      {status ? <div className="status-banner success">{status}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
    </section>
  );
}
