import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../../shared/components/NotificationCenter";
import { createNotificationRequests } from "../../shared/context/notificationRequests";
import { applyNotificationRead, mergeNotificationPage } from "../../shared/context/notificationPages";

const inbox = "/api/admin/notifications";

async function request(path, options) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...options });
  if (!response.ok) throw new Error("Notifications could not be updated. Please retry.");
  return response.json();
}

function relativeTime(stamp, now) {
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return "";
  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function isSameLocalDay(stamp, now) {
  const date = new Date(stamp);
  const current = new Date(now);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === current.getFullYear() &&
    date.getMonth() === current.getMonth() &&
    date.getDate() === current.getDate()
  );
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const newest = useRef(null);
  const [data, setData] = useState({ notifications: [], next_cursor: null, unread_count: 0 });
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const channel = useRef(null);

  useEffect(() => {
    const requests = createNotificationRequests({
      get: async ({ cursor, signal }) => {
        const page = await request(inbox + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), { signal });
        return {
          data: {
            ...page,
            notifications: page.items.map((item) => ({ ...item, is_read: Boolean(item.read_at) })),
          },
        };
      },
      read: (id, { signal }) => request(inbox + (id ? "/" + id + "/read" : "/read-all"), { method: "POST", signal }),
      onPage: (page, append) => {
        if (!append) {
          const previous = newest.current;
          if (
            previous &&
            page.notifications.some(
              (item) => !item.is_read && !previous.ids.has(item.id) && item.created_at >= previous.time,
            )
          ) {
            setAnnouncement("New notification. " + page.unread_count + " unread.");
            setBellRinging(true);
          }
          newest.current = {
            ids: new Set(page.notifications.map((item) => item.id)),
            time: page.notifications[0]?.created_at ?? "",
          };
        }
        setNow(Date.now());
        setData((current) => mergeNotificationPage(current, page, append));
      },
      onRead: (id) => setData((current) => applyNotificationRead(current, id)),
      onLoading: setLoading,
      onWriting: setWriting,
      onError: setError,
      onWriteError: setWriteError,
    });
    channel.current = requests;
    const refresh = () => {
      if (!document.hidden) requests.refresh();
    };
    refresh();
    const timer = setInterval(refresh, 25000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      requests.dispose();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    if (!bellRinging) return undefined;
    const timer = window.setTimeout(() => setBellRinging(false), 700);
    return () => window.clearTimeout(timer);
  }, [bellRinging]);

  const items = useMemo(
    () =>
      data.notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        isRead: Boolean(item.is_read),
        timeLabel: relativeTime(item.created_at, now),
        timeDateTime: item.created_at,
        group: !item.is_read ? "new" : isSameLocalDay(item.created_at, now) ? "today" : "earlier",
        raw: item,
      })),
    [data.notifications, now],
  );

  async function handleSelect(item) {
    if (!item.is_read && !(await channel.current?.markRead(item.id))) return;
    setOpen(false);
    if (item.link_path.startsWith("/admin/")) navigate(item.link_path);
  }

  return (
    <NotificationCenter
      id="admin-inbox"
      heading="Notifications"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) channel.current?.refresh();
      }}
      items={items}
      unreadCount={data.unread_count}
      loading={loading}
      busy={writing}
      error={writeError || error}
      announcement={announcement}
      bellRinging={bellRinging}
      onSelect={handleSelect}
      onMarkAllRead={() => channel.current?.markRead()}
      onRefresh={() => channel.current?.refresh()}
      hasMore={Boolean(data.next_cursor)}
      onLoadMore={() => channel.current?.refresh(data.next_cursor)}
    />
  );
}
