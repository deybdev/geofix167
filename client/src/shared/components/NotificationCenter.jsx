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

function parseItemDisplay(item) {
  const rawTitle = cleanText(item.title || "");
  const hasHighPrefix = HIGH_PREFIX_RE.test(rawTitle);
  const title = rawTitle.replace(HIGH_PREFIX_RE, "").trim() || rawTitle;
  const cleanedBody = cleanText(item.body || "");

  let categories = [];
  let body = cleanedBody;
  if (cleanedBody.includes(" + ")) {
    const parts = cleanedBody
      .split(/\s+\+\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      categories = parts;
      body = "";
    }
  }

  return {
    title,
    isHigh: Boolean(item.isHigh ?? (hasHighPrefix || item.type === "emergency_forwarded")),
    body,
    categories,
  };
}

function getTileMeta(type, isHigh) {
  if (type === "emergency_forwarded" || type === "INCIDENT_REVIEW") {
    return {
      Icon: Siren,
      tileClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      isDanger: true,
    };
  }
  if (type === "DECLINED" || type === "SUPPORT" || type === "SUPPORT_REQUEST" || isHigh) {
    return {
      Icon: CircleAlert,
      tileClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      isDanger: true,
    };
  }
  if (
    type === "handover_submitted" ||
    type === "hospital_acknowledged" ||
    type === "resolution_ready" ||
    type === "HANDOVER"
  ) {
    return {
      Icon: CheckCircle,
      tileClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      isDanger: false,
    };
  }
  if (
    type === "maintenance_intake" ||
    type === "maintenance_verification" ||
    type === "CLOSURE_REVIEW"
  ) {
    return {
      Icon: ClipboardCheck,
      tileClass: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      isDanger: false,
    };
  }
  if (type === "registration_pending") {
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

function isEmergencyNotification(item) {
  if (typeof item.isEmergency === "boolean") return item.isEmergency;
  return (
    item.type === "emergency_forwarded" ||
    item.type === "INCIDENT_REVIEW" ||
    item.type === "DECLINED" ||
    item.type === "SUPPORT" ||
    item.type === "SUPPORT_REQUEST" ||
    HIGH_PREFIX_RE.test(item.title || "")
  );
}

function groupItems(items) {
  const buckets = { new: [], today: [], earlier: [] };
  for (const item of items) {
    if (!item.isRead) {
      buckets.new.push(item);
    } else if (item.group === "earlier") {
      buckets.earlier.push(item);
    } else {
      buckets.today.push(item);
    }
  }
  return [
    { key: "new", label: "New", items: buckets.new },
    { key: "today", label: "Earlier today", items: buckets.today },
    { key: "earlier", label: "Earlier", items: buckets.earlier },
  ].filter((group) => group.items.length > 0);
}

export default function NotificationCenter({
  id = "notifications-inbox",
  heading = "Notifications",
  open,
  onOpenChange,
  items = [],
  unreadCount = 0,
  loading = false,
  busy = false,
  error = "",
  announcement = "",
  bellRinging = false,
  onSelect,
  onMarkAllRead,
  onRefresh,
  hasMore = false,
  onLoadMore,
  emptyTitle = "You're all caught up",
  badgeTone = "brand",
}) {
  const [filter, setFilter] = useState("all");
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) onOpenChange(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
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
  }, [open, onOpenChange]);

  const filteredItems = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.isRead);
    if (filter === "emergency") return items.filter(isEmergencyNotification);
    return items;
  }, [items, filter]);

  const groups = useMemo(() => groupItems(filteredItems), [filteredItems]);

  const emergencyCount = useMemo(
    () => items.filter(isEmergencyNotification).length,
    [items],
  );

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

  const showSkeleton = loading && items.length === 0 && !error;
  const badgeBg = badgeTone === "danger" ? "bg-red-600" : "bg-(--gf-green)";

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${heading}, ${unreadCount} unread`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={`relative grid h-9 w-9 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) focus-visible:ring-offset-2 ${
          open
            ? "border-(--gf-green-border) bg-(--gf-green-soft) text-(--gf-green-dark)"
            : "border-(--gf-border) bg-white text-(--gf-green-dark) hover:border-(--gf-green-border) hover:bg-(--gf-green-soft)"
        }`}
      >
        <Bell size={16} className={bellRinging ? "gf-bell-ring" : ""} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className={`absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white ${badgeBg}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <section
        id={id}
        aria-label={heading}
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
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-bold text-(--gf-ink)">{heading}</h2>
              {unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-(--gf-green-tint) px-2 py-0.5 text-[11px] font-semibold text-(--gf-green-dark)">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={busy || !unreadCount}
                onClick={() => onMarkAllRead?.()}
                className="rounded-md px-1.5 py-1 text-xs font-medium text-(--gf-slate) transition-colors hover:bg-(--gf-green-soft) hover:text-(--gf-green-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all as read
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5" role="group" aria-label="Filter notifications">
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              const count =
                key === "unread"
                  ? unreadCount
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
          {error && (
            <div
              role="alert"
              className="m-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
            >
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{error}</p>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                )}
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

          {!error && !showSkeleton && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-(--gf-green-soft) text-(--gf-green)">
                <CheckCircle2 size={20} />
              </span>
              <p className="mt-3 text-sm font-semibold text-(--gf-ink)">{emptyTitle}</p>
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
                      const { title, isHigh, body, categories } = parseItemDisplay(item);
                      const { Icon, tileClass, isDanger } = getTileMeta(item.type, isHigh);
                      const unread = !item.isRead;
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
                            disabled={busy}
                            onClick={() => onSelect?.(item.raw ?? item)}
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
                                  {item.timeLabel && (
                                    <time
                                      dateTime={item.timeDateTime}
                                      className="text-[11px] tabular-nums text-(--gf-slate-2)"
                                    >
                                      {item.timeLabel}
                                    </time>
                                  )}
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

                              {item.metaTag && (
                                <span className="mt-1.5 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-(--gf-slate) ring-1 ring-inset ring-slate-200/80">
                                  {item.metaTag}
                                </span>
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

          {hasMore && !showSkeleton && (
            <div className="border-t border-(--gf-line) p-2.5 text-center">
              <button
                type="button"
                disabled={loading || busy}
                onClick={onLoadMore}
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
