import { useEffect, useMemo, useRef, useState } from "react";
import NotificationCenter from "./NotificationCenter";
import { useBdrrmoDemo } from "../../features/bdrrmo/BdrrmoDemoContext";

function classifyElapsedGroup(elapsed, read) {
  if (!read) return "new";
  if (typeof elapsed !== "string") return "today";
  const hoursMatch = elapsed.match(/(\d+)\s*h/i);
  if (hoursMatch && Number(hoursMatch[1]) >= 24) return "earlier";
  const daysMatch = elapsed.match(/(\d+)\s*d/i);
  if (daysMatch && Number(daysMatch[1]) >= 1) return "earlier";
  return "today";
}

export default function BdrrmoNotifications({ onOpenIncident }) {
  const { notifications, unreadCount, markRead, markAllRead, refresh, sync } = useBdrrmoDemo();
  const [open, setOpen] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const prevIdsRef = useRef(null);

  useEffect(() => {
    const currentIds = new Set(notifications.map((item) => item.id));
    if (prevIdsRef.current) {
      const hasNewUnread = notifications.some(
        (item) => !item.read && !prevIdsRef.current.has(item.id),
      );
      if (hasNewUnread) {
        const frame = requestAnimationFrame(() => setBellRinging(true));
        prevIdsRef.current = currentIds;
        return () => cancelAnimationFrame(frame);
      }
    }
    prevIdsRef.current = currentIds;
    return undefined;
  }, [notifications]);

  useEffect(() => {
    if (!bellRinging) return undefined;
    const timer = window.setTimeout(() => setBellRinging(false), 700);
    return () => window.clearTimeout(timer);
  }, [bellRinging]);

  const items = useMemo(
    () =>
      notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        isRead: Boolean(item.read),
        timeLabel: item.createdAt,
        group: classifyElapsedGroup(item.createdAt, item.read),
        isEmergency:
          item.type === "INCIDENT_REVIEW" ||
          item.type === "SUPPORT" ||
          item.type === "SUPPORT_REQUEST",
        isHigh:
          item.type === "INCIDENT_REVIEW" ||
          item.type === "SUPPORT" ||
          item.type === "SUPPORT_REQUEST",
        metaTag: item.incidentId || undefined,
        raw: item,
      })),
    [notifications],
  );

  function handleSelect(item) {
    markRead(item.id);
    if (item.incidentId) onOpenIncident?.(item.incidentId);
    setOpen(false);
  }

  return (
    <NotificationCenter
      id="bdrrmo-inbox"
      heading="Operational notifications"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
      items={items}
      unreadCount={unreadCount}
      loading={sync.state === "syncing"}
      error={sync.state === "error" ? "Operational notifications could not be refreshed. Please retry." : ""}
      bellRinging={bellRinging}
      onSelect={handleSelect}
      onMarkAllRead={markAllRead}
      onRefresh={refresh}
      badgeTone="danger"
    />
  );
}
