import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/residentService";
import { NotificationContext } from "../hooks/useNotifications";
import { applyNotificationRead, mergeNotificationPage } from "./notificationPages";

import { createNotificationRequests } from "./notificationRequests";

export function NotificationProvider({ userId, children }) {
  const [data, setData] = useState({ notifications: [], unread_count: 0, next_cursor: null });
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [writing, setWriting] = useState(false);
  // ResidentLayout keys this provider by account, so callbacks stay stable for its lifetime.
  const [requests] = useState(() => createNotificationRequests({
    get: getNotifications,
    read: (id, options) => id ? markNotificationRead(id, options) : markAllNotificationsRead(options),
    onPage: (fresh, append) => setData(previous => mergeNotificationPage(previous, fresh, append)),
    onRead: id => setData(previous => applyNotificationRead(previous, id)),
    onLoading: setLoading, onWriting: setWriting, onError: setError, onWriteError: setWriteError,
  }));
  const { refresh, markRead } = requests;
  useEffect(() => {
    if (!userId) { requests.dispose(); return; }
    requests.activate();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    visibleRefresh();
    const timer = setInterval(visibleRefresh, 60000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
      requests.dispose();
    };
  }, [refresh, requests, userId]);
  return <NotificationContext.Provider value={{ ...data, unreadCount: data.unread_count,
    loading, error, writeError, writing, refresh, markRead,
    loadMore: () => data.next_cursor && refresh(data.next_cursor) }}>
    {children}
  </NotificationContext.Provider>;
}
