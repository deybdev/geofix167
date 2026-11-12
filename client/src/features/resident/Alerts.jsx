import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/residentService";

const TYPE_COLORS = {
  report_update: "bg-blue-50 text-blue-600",
  emergency_update: "bg-red-50 text-red-600",
  announcement: "bg-green-50 text-green-600",
};

export default function Alerts() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    getNotifications()
      .then(({ data }) => setNotifications(data.notifications))
      .catch(() => setError("Failed to load notifications."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleMarkRead(id) {
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
    );
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex justify-end">
        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
            <Bell size={28} className="text-slate-400" />
          </span>
          <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
          <p className="text-xs text-slate-500">You'll be notified about your reports and announcements here.</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                n.is_read
                  ? "border-slate-100 bg-white"
                  : "border-primary/20 bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs ${TYPE_COLORS[n.type] ?? "bg-slate-100 text-slate-500"}`}>
                  <Bell size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.is_read ? "text-slate-700" : "text-slate-900"}`}>
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(n.created_at).toLocaleDateString("en-PH", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
