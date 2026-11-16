import { useCallback, useEffect, useRef, useState } from "react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/residentService";
import { NotificationContext } from "../hooks/useNotifications";
import { applyNotificationRead, mergeNotificationPage } from "./notificationPages";

export function NotificationProvider({ userId, children }) {
  const [data, setData] = useState({ notifications: [], unread_count: 0, next_cursor: null });
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [writing, setWriting] = useState(false);
  const request = useRef(null);
  const write = useRef(null);
  const refresh = useCallback(async (cursor = null) => {
    if (!userId || request.current || write.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const { data: fresh } = await getNotifications({ cursor, signal: controller.signal });
      if (!controller.signal.aborted) setData(previous => mergeNotificationPage(previous, fresh, Boolean(cursor)));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    visibleRefresh();
    const timer = setInterval(visibleRefresh, 60000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
      request.current?.abort();
      request.current = null;
      write.current?.abort();
      write.current = null;
    };
  }, [refresh]);
  async function markRead(id = null) {
    if (!userId || write.current) return false;
    request.current?.abort();
    request.current = null;
    setLoading(false);
    const controller = new AbortController();
    write.current = controller;
    setWriting(true);
    setWriteError("");
    try {
      if (id) await markNotificationRead(id, { signal: controller.signal });
      else await markAllNotificationsRead({ signal: controller.signal });
      if (controller.signal.aborted) return false;
      setData(previous => applyNotificationRead(previous, id));
      return true;
    } catch (failure) {
      if (!controller.signal.aborted) setWriteError(failure.message);
      return false;
    } finally {
      if (write.current === controller) write.current = null;
      if (!controller.signal.aborted) { setWriting(false); void refresh(); }
    }
  }
  return <NotificationContext.Provider value={{ ...data, unreadCount: data.unread_count,
    loading, error, writeError, writing, refresh, markRead,
    loadMore: () => data.next_cursor && refresh(data.next_cursor) }}>
    {children}
  </NotificationContext.Provider>;
}
