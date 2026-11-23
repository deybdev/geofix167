import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle, CircleAlert, ClipboardCheck, Radio, UserRound, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createNotificationRequests } from "../../shared/context/notificationRequests";
import { applyNotificationRead, mergeNotificationPage } from "../../shared/context/notificationPages";

const inbox = "/api/admin/notifications";
const soundKey = "geofix.admin.notification-sound";
const icons = {
  emergency_forwarded: CircleAlert, DECLINED: CircleAlert, registration_pending: UserRound,
  maintenance_intake: ClipboardCheck, maintenance_verification: ClipboardCheck,
  handover_submitted: CheckCircle, hospital_acknowledged: CheckCircle, resolution_ready: CheckCircle,
};

async function request(path, options) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...options });
  if (!response.ok) throw new Error("Notifications could not be updated. Please retry.");
  return response.json();
}

function relativeTime(stamp, now) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(stamp)) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function chime(context) {
  if (context?.state !== "running") return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.08, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.16);
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(soundKey) !== "off");
  const sound = useRef(enabled);
  const audio = useRef(null);
  const newest = useRef(null);
  const wrapper = useRef(null);
  const trigger = useRef(null);
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
        return { data: { ...page, notifications: page.items.map(item => ({ ...item, is_read: Boolean(item.read_at) })) } };
      },
      read: (id, { signal }) => request(inbox + (id ? "/" + id + "/read" : "/read-all"), { method: "POST", signal }),
      onPage: (page, append) => {
        if (!append) {
          const previous = newest.current;
          if (previous && page.notifications.some(item => !item.is_read && !previous.ids.has(item.id) && item.created_at >= previous.time)) {
            setAnnouncement("New notification. " + page.unread_count + " unread.");
            if (sound.current) chime(audio.current);
          }
          newest.current = { ids: new Set(page.notifications.map(item => item.id)), time: page.notifications[0]?.created_at ?? "" };
        }
        setNow(Date.now());
        setData(current => mergeNotificationPage(current, page, append));
      },
      onRead: id => setData(current => applyNotificationRead(current, id)),
      onLoading: setLoading, onWriting: setWriting, onError: setError, onWriteError: setWriteError,
    });
    channel.current = requests;
    const refresh = () => { if (!document.hidden) requests.refresh(); };
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
    const unlock = () => {
      const AudioEngine = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioEngine || !sound.current) return;
      audio.current ??= new AudioEngine();
      if (audio.current.state === "suspended") void audio.current.resume().catch(() => {});
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
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

  const toggleSound = () => {
    sound.current = !enabled;
    setEnabled(!enabled);
    localStorage.setItem(soundKey, enabled ? "off" : "on");
  };
  async function select(item) {
    if (!item.is_read && !await channel.current?.markRead(item.id)) return;
    setOpen(false);
    if (item.link_path.startsWith("/admin/")) navigate(item.link_path);
  }
  const SoundIcon = enabled ? Volume2 : VolumeX;
  return <>
    <button type="button" onClick={toggleSound} aria-pressed={enabled} className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-200 px-2 text-xs font-bold text-emerald-800">
      <SoundIcon size={15} /> Sound: {enabled ? "ON" : "OFF"}
    </button>
    <div className="relative" ref={wrapper}>
      <button ref={trigger} type="button" aria-label={"Notifications, " + data.unread_count + " unread"} aria-expanded={open} aria-controls="admin-inbox"
        className="relative grid h-9 w-9 place-items-center rounded-full border text-emerald-800" onClick={() => { setOpen(!open); if (!open) channel.current?.refresh(); }}>
        <Bell size={16} />
        {data.unread_count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-emerald-800 px-1.5 text-[10px] font-bold text-white">{data.unread_count > 9 ? "9+" : data.unread_count}</span>}
      </button>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      {open && <section id="admin-inbox" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 max-h-[75dvh] w-[min(23rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border bg-white p-3 shadow-xl">
        <header className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-bold">Notifications</h2>
          <button type="button" disabled={writing || !data.unread_count} className="text-xs font-semibold text-emerald-800 disabled:text-slate-500" onClick={() => channel.current?.markRead()}>Mark all as read</button>
        </header>
        {(error || writeError) && <p role="alert" className="my-2 text-sm">{writeError || error} <button type="button" onClick={() => channel.current?.refresh()} className="underline">Refresh</button></p>}
        {loading && <p role="status" className="py-1 text-xs">Checking for notifications…</p>}
        {!error && !loading && !data.notifications.length && <p className="py-3 text-sm">You're all caught up</p>}
        <ul>{data.notifications.map(item => {
          const Icon = icons[item.type] ?? Radio;
          return <li key={item.id}><button type="button" disabled={writing} onClick={() => select(item)} className="flex w-full items-start gap-2 rounded-lg px-2 py-3 text-left hover:bg-emerald-50 focus-visible:outline-2">
            <Icon size={16} className="mt-1 shrink-0 text-emerald-800" />
            <span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="block truncate text-xs">{item.body}</span><time dateTime={item.created_at} className="text-xs text-slate-600">{relativeTime(item.created_at, now)}</time></span>
            {!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-700"><span className="sr-only">Unread</span></span>}
          </button></li>;
        })}</ul>
        {data.next_cursor && <button type="button" className="gf-btn" disabled={loading || writing} onClick={() => channel.current?.refresh(data.next_cursor)}>Load more</button>}
      </section>}
    </div>
  </>;
}
