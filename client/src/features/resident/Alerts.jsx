import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../shared/hooks/useNotifications";
import { PATHS } from "../../router/paths";

export default function Alerts() {
  const { notifications, unreadCount, next_cursor, loading, error, writeError,
    writing, refresh, loadMore, markRead } = useNotifications();
  const navigate = useNavigate();
  async function open(notification) {
    if (!notification.is_read && !await markRead(notification.id)) return;
    // Notification entries never claim My Reports as their previous entry.
    navigate(PATHS.reportDetails + '/' + encodeURIComponent(notification.ref_id));
  }
  return <section className="mx-auto max-w-md space-y-4" aria-label="Report notifications" aria-busy={loading}>
    <div className="flex justify-between gap-3">
      <button type="button" disabled={loading || writing} onClick={() => refresh()} className="text-sm text-primary">Refresh</button>
      <button type="button" disabled={!unreadCount || writing} onClick={() => markRead()} className="text-sm text-primary disabled:opacity-50">Mark all read</button>
    </div>
    {loading && <p role="status">Loading notifications...</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
      <p>{error}</p><button type="button" onClick={() => refresh()} disabled={loading}>Try again</button>
    </div>}
    {writeError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{writeError}</p>}
    {!loading && !error && notifications.length === 0 && <p className="py-12 text-center">No notifications yet. Report updates will appear here.</p>}
    <ul className="space-y-3">
      {notifications.map(n => <li key={n.id} className={'rounded-xl border p-4 ' + (n.is_read ? 'bg-white' : 'border-primary/20 bg-primary/5')}>
        <button type="button" disabled={writing} onClick={() => open(n)} className="w-full text-left">
          <span className="block text-sm font-semibold">{n.title}{!n.is_read && <span className="ml-2 text-xs text-primary">Unread</span>}</span>
          <span className="mt-1 block text-sm">{n.body}</span>
          <time className="mt-2 block text-xs text-slate-500" dateTime={n.created_at}>{new Date(n.created_at).toLocaleString("en-PH")}</time>
          <span className="mt-2 block text-xs text-primary">View report</span>
        </button>
        {!n.is_read && <button type="button" disabled={writing} onClick={() => markRead(n.id)} className="mt-3 text-xs text-primary">Mark read</button>}
      </li>)}
    </ul>
    {next_cursor && <button type="button" disabled={loading || writing} onClick={loadMore} className="w-full rounded-lg border p-3">Load more</button>}
  </section>;
}
