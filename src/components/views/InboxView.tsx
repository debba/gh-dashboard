import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/github";
import type { GhIssue, GhNotification, GhPullRequest, GhRepo } from "../../types/github";
import {
  buildInboxItems,
  filterInboxItems,
  INBOX_MAILBOXES,
  mergeNotifications,
  type InboxMailbox,
} from "../../utils/inbox";
import { formatNumber } from "../../utils/format";
import { TriageWorkspace } from "./TriageWorkspace";

interface InboxViewProps {
  issues: GhIssue[];
  pullRequests: GhPullRequest[];
  userLogin: string;
  reposByName: Map<string, GhRepo>;
  onRepoClick: (repo: GhRepo) => void;
}

export function InboxView({ issues, pullRequests, userLogin, reposByName, onRepoClick }: InboxViewProps) {
  const [mailbox, setMailbox] = useState<InboxMailbox>("inbox");
  const [notifications, setNotifications] = useState<GhNotification[]>([]);
  const [pollInterval, setPollInterval] = useState(60);

  const refreshNotifications = useCallback(async (fresh = false) => {
    try {
      const data = await fetchNotifications(fresh);
      setNotifications(data.notifications);
      if (data.pollInterval) setPollInterval(data.pollInterval);
    } catch {
      // silent — Inbox still works without notifications
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = window.setInterval(() => { void refreshNotifications(); }, Math.max(30, pollInterval) * 1000);
    return () => window.clearInterval(id);
  }, [pollInterval, refreshNotifications]);

  const baseItems = useMemo(
    () => buildInboxItems({ issues, pullRequests, userLogin }),
    [issues, pullRequests, userLogin],
  );
  const items = useMemo(() => mergeNotifications(baseItems, notifications), [baseItems, notifications]);
  const mailboxItems = useMemo(() => filterInboxItems(items, mailbox), [items, mailbox]);
  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);
  const title = INBOX_MAILBOXES.find((entry) => entry.key === mailbox)?.label || "Inbox";

  const handleMarkRead = useCallback(async (threadId: string) => {
    setNotifications((prev) => prev.map((entry) => (entry.id === threadId ? { ...entry, unread: false } : entry)));
    try {
      await markNotificationRead(threadId);
    } catch {
      void refreshNotifications(true);
    }
  }, [refreshNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount) return;
    if (!window.confirm(`Mark ${unreadCount} notification${unreadCount === 1 ? "" : "s"} as read on GitHub?`)) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((entry) => ({ ...entry, unread: false })));
    try {
      await markAllNotificationsRead();
    } catch {
      setNotifications(previous);
    }
  }, [notifications, unreadCount]);

  const sidebar = (
    <aside className="inbox-mailboxes">
      <div className="inbox-mailbox-title">
        <span>Triage</span>
        <strong>{formatNumber(items.length)}</strong>
      </div>
      <div className="inbox-mailbox-list">
        {INBOX_MAILBOXES.map((entry) => {
          const count = filterInboxItems(items, entry.key).length;
          return (
            <button
              className={mailbox === entry.key ? "active" : ""}
              key={entry.key}
              type="button"
              onClick={() => setMailbox(entry.key)}
            >
              <span>{entry.label}</span>
              <strong>{formatNumber(count)}</strong>
            </button>
          );
        })}
      </div>
      {unreadCount ? (
        <button className="inbox-mailbox-action" type="button" onClick={() => void handleMarkAllRead()}>
          Mark all as read
        </button>
      ) : null}
    </aside>
  );

  return (
    <TriageWorkspace
      className="view-inbox"
      items={mailboxItems}
      title={title}
      emptyTitle="No inbox items"
      emptyMessage="Try another mailbox or clear the search."
      reposByName={reposByName}
      onRepoClick={onRepoClick}
      sidebar={sidebar}
      searchPlaceholder="Search inbox"
      onMarkRead={handleMarkRead}
    />
  );
}
