import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Radio,
  RefreshCw,
  Siren,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createNotificationRequests } from "../../shared/context/notificationRequests";
import { applyNotificationRead, mergeNotificationPage } from "../../shared/context/notificationPages";

const inbox = "/api/admin/notifications";
const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "emergency", label: "Emergency" },
];

const HIGH_PREFIX_RE = /^high\s*[·•:\-–—]\s*/i;
const DUPLICATE_INCIDENT_RE = /\bIncident\s+Incident\s+Report\b/gi;

function cleanText(text) {
  if (typeof text !== "string") return "";
  return text.replace(DUPLICATE_INCIDENT_RE, "Incident Report").trim();
}

function isEmergencyItem(item) {
  return (
    item.type === "emergency_forwarded" ||
    item.type === "DECLINED" ||
    HIGH_PREFIX_RE.test(item.title || "")
  );
}

function parseDisplay(item) {
  const rawTitle = cleanText(item.title || "");
  const isHigh = HIGH_PREFIX_RE.test(rawTitle) || item.type === "emergency_forwarded";
  const title = rawTitle.replace(HIGH_PREFIX_RE, "").trim() || rawTitle;
  const cleanedBody = cleanText(item.body || "");

  const hasMultiCategories = cleanedBody.includes(" + ");
  let categories = [];
  let body = cleanedBody;
  if (hasMultiCategories) {
    const parts = cleanedBody
      .split(/\s+\+\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      categories = parts;
      body = "";
    }
  }

  return { title, isHigh, body, categories };
}

function getTileMeta(item, isHigh) {
  if (item.type === "emergency_forwarded") {
    return {
      Icon: Siren,
      tileClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      isDanger: true,
    };
  }
  if (item.type === "DECLINED" || isHigh) {
    return {
      Icon: CircleAlert,
      tileClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      isDanger: true,
    };
  }
  if (
    item.type === "handover_submitted" ||
    item.type === "hospital_acknowledged" ||
    item.type === "resolution_ready"
  ) {
    return {
      Icon: CheckCircle,
      tileClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      isDanger: false,
    };
  }
  if (item.type === "maintenance_intake" || item.type === "maintenance_verification") {
    return {
      Icon: ClipboardCheck,
      tileClass: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      isDanger: false,
    };
  }
  if (item.type === "registration_pending") {
    return {
      Icon: UserRound,
      tileClass: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
      isDanger: false,
    };
  }
  return {
    Icon: Radio,
    tileClass: "bg-(--gf-green-tint) text-(--gf-green-dark) ring-1 ring-inset ring-(--gf-green-border)",
    isDanger: false,
  };
}

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

function groupNotifications(items, now) {
  const buckets = {
    new: [],
    today: [],
    earlier: [],
  };
  for (const item of items) {
    if (!item.is_read) {
      buckets.new.push(item);
    } else if (isSameLocalDay(item.created_at, now)) {
      buckets.today.push(item);
    } else {
      buckets.earlier.push(item);
    }
  }
  return [
    { key: "new", label: "New", items: buckets.new },
    { key: "today", label: "Earlier today", items: buckets.today },
    { key: "earlier", label: "Earlier", items: buckets.earlier },
  ].filter((group) => group.items.length > 0);
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [bellRinging, setBellRinging] = useState(false);
  const newest = useRef(null);
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const listRef = useRef(null);
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

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return data.notifications.filter((item) => !item.is_read);
    if (filter === "emergency") return data.notifications.filter(isEmergencyItem);
    return data.notifications;
  }, [data.notifications, filter]);

  const groups = useMemo(
    () => groupNotifications(filteredNotifications, now),
    [filteredNotifications, now],
  );

  const emergencyCount = useMemo(
    () => data.notifications.filter(isEmergencyItem).length,
    [data.notifications],
  );

  async function select(item) {
    if (!item.is_read && !(await channel.current?.markRead(item.id))) return;
    setOpen(false);
    if (item.link_path.startsWith("/admin/")) navigate(item.link_path);
  }

  function handleListKeyDown(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = listRef.current?.querySelectorAll("button[data-notif-item]");
    if (!buttons?.length) return;
    const index = Array.from(buttons).indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  }

  const showSkeleton = loading && data.notifications.length === 0 && !error;
  const activeError = writeError || error;

  return (
    <div className="relative" ref={wrapper}>
      <button
        ref={trigger}
        type="button"
        aria-label={"Notifications, " + data.unread_count + " unread"}
        aria-expanded={open}
        aria-controls="admin-inbox"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) channel.current?.refresh();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-(--gf-border) bg-white text-(--gf-green-dark) transition-colors hover:border-(--gf-green-border) hover:bg-(--gf-green-soft) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) focus-visible:ring-offset-2"
      >
        <Bell size={16} className={bellRinging ? "gf-bell-ring" : ""} />
        {data.unread_count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-(--gf-green) px-1 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {data.unread_count > 9 ? "9+" : data.unread_count}
          </span>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <section
        id="admin-inbox"
        aria-label="Notifications"
        aria-hidden={!open}
        inert={!open ? "" : undefined}
        className={`fixed inset-x-2 top-[66px] z-50 flex max-h-[70dvh] flex-col rounded-xl border border-(--gf-border) bg-white shadow-[0_14px_34px_-10px_rgb(15_23_42/0.16)] transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[380px] ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0 pointer-events-none"
        }`}
      >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-1.5 right-3.5 hidden h-3 w-3 rotate-45 border-l border-t border-(--gf-border) bg-white sm:block"
          />

          <header className="shrink-0 border-b border-(--gf-line) px-4 pb-3 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-(--gf-ink)">Notifications</h2>
                {data.unread_count > 0 && (
                  <span className="rounded-full bg-(--gf-green-tint) px-2 py-0.5 text-[11px] font-semibold text-(--gf-green-dark)">
                    {data.unread_count} new
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={writing || !data.unread_count}
                onClick={() => channel.current?.markRead()}
                className="rounded-md px-1.5 py-1 text-xs font-medium text-(--gf-slate) transition-colors hover:bg-(--gf-green-soft) hover:text-(--gf-green-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all as read
              </button>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5" role="group" aria-label="Filter notifications">
              {FILTERS.map(({ key, label }) => {
                const active = filter === key;
                const count =
                  key === "unread"
                    ? data.unread_count
                    : key === "emergency"
                      ? emergencyCount
                      : null;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(key)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) ${
                      active
                        ? "bg-(--gf-green) text-white"
                        : "bg-slate-100 text-(--gf-slate) hover:bg-(--gf-green-soft) hover:text-(--gf-green-dark)"
                    }`}
                  >
                    <span>{label}</span>
                    {count !== null && count > 0 && (
                      <span
                        className={`rounded-full px-1 text-[10px] leading-4 ${
                          active ? "bg-white/20 text-white" : "bg-white text-(--gf-ink)"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </header>

          <div
            ref={listRef}
            onKeyDown={handleListKeyDown}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-xl"
          >
            {activeError && (
              <div
                role="alert"
                className="m-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{activeError}</p>
                  <button
                    type="button"
                    onClick={() => channel.current?.refresh()}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {showSkeleton && (
              <div role="status" aria-label="Loading notifications" className="divide-y divide-(--gf-line) p-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-start gap-3 px-2 py-3 animate-pulse motion-reduce:animate-none">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2 py-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-3 w-3/5 rounded bg-slate-200" />
                        <div className="h-2.5 w-10 rounded bg-slate-100" />
                      </div>
                      <div className="h-2.5 w-4/5 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!activeError && !showSkeleton && groups.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-(--gf-green-soft) text-(--gf-green)">
                  <CheckCircle2 size={20} />
                </span>
                <p className="mt-3 text-sm font-semibold text-(--gf-ink)">You&apos;re all caught up</p>
                {filter !== "all" && (
                  <p className="mt-1 text-xs text-(--gf-slate)">
                    No {filter} notifications right now.
                  </p>
                )}
              </div>
            )}

            {!showSkeleton && groups.length > 0 && (
              <div>
                {groups.map((group) => (
                  <div key={group.key}>
                    <div className="sticky top-0 z-10 border-b border-(--gf-line) bg-white/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--gf-slate) backdrop-blur-xs">
                      {group.label}
                    </div>
                    <ul className="divide-y divide-(--gf-line)">
                      {group.items.map((item) => {
                        const { title, isHigh, body, categories } = parseDisplay(item);
                        const { Icon, tileClass, isDanger } = getTileMeta(item, isHigh);
                        const unread = !item.is_read;
                        const rowTint = unread
                          ? isDanger
                            ? "bg-red-50/40 hover:bg-red-50/75"
                            : "bg-(--gf-green-soft) hover:bg-(--gf-green-tint)/60"
                          : "bg-white hover:bg-slate-50";
                        const accentColor = isDanger ? "bg-red-600" : "bg-(--gf-green)";

                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              data-notif-item
                              disabled={writing}
                              onClick={() => select(item)}
                              className={`relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--gf-green) disabled:opacity-60 ${rowTint}`}
                            >
                              {unread && (
                                <span
                                  aria-hidden="true"
                                  className={`absolute inset-y-1.5 left-0 w-[3px] rounded-r-full ${accentColor}`}
                                />
                              )}

                              <span
                                aria-hidden="true"
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tileClass}`}
                              >
                                <Icon size={17} strokeWidth={2} />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <strong className="text-[13px] font-semibold leading-snug text-(--gf-ink)">
                                      {title}
                                    </strong>
                                    {isHigh && (
                                      <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-700 ring-1 ring-inset ring-red-200">
                                        High
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                                    <time
                                      dateTime={item.created_at}
                                      className="text-[11px] tabular-nums text-(--gf-slate-2)"
                                    >
                                      {relativeTime(item.created_at, now)}
                                    </time>
                                    {unread && (
                                      <span className={`h-2 w-2 rounded-full ${accentColor}`}>
                                        <span className="sr-only">Unread</span>
                                      </span>
                                    )}
                                  </span>
                                </span>

                                {categories.length > 0 ? (
                                  <span className="mt-1.5 flex flex-wrap gap-1">
                                    {categories.map((cat) => (
                                      <span
                                        key={cat}
                                        className="inline-flex max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-(--gf-ink) ring-1 ring-inset ring-slate-200/80"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  body && (
                                    <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-(--gf-slate)">
                                      {body}
                                    </span>
                                  )
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {data.next_cursor && !showSkeleton && (
              <div className="border-t border-(--gf-line) p-2.5 text-center">
                <button
                  type="button"
                  disabled={loading || writing}
                  onClick={() => channel.current?.refresh(data.next_cursor)}
                  className="w-full rounded-lg border border-(--gf-border) bg-white py-2 text-xs font-semibold text-(--gf-ink) transition-colors hover:bg-(--gf-green-soft) hover:text-(--gf-green-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        </section>
    </div>
  );
}
