import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Clock3, Edit3, Megaphone, Plus, Search, Trash2, X } from "lucide-react";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";
import { toast } from "../../shared/components/ui/toast";
import catalog from "../../../../server/src/shared/announcementCatalog.json";

const emptyForm = { title: "", details: "", category: "General", event_date: "", event_time: "", venue: "" };
const manilaToday = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const formatTime = (value) => value ? new Date(`1970-01-01T${value}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
async function api(path = "", { method = "GET", body } = {}) {
  const response = await fetch(`/api/admin/announcements${path}`, { method, credentials: "include", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Announcement request failed.");
  return data;
}
const formatDate = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : "No event date";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]); const [filter, setFilter] = useState("All"); const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false); const [form, setForm] = useState(emptyForm); const [editingId, setEditingId] = useState(null); const [formError, setFormError] = useState(""); const [pending, setPending] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const data = await api(`?status=${filter === "All" ? "" : filter.toLowerCase()}&q=${encodeURIComponent(query)}`); setAnnouncements(data.announcements || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, [filter, query]);
  useEffect(() => { void load(); }, [load]);
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormError(""); setIsFormOpen(true); };
  const edit = (item) => { setEditingId(item.id); setForm({ title: item.title, details: item.details, category: item.category, event_date: item.event_date?.slice(0, 10) || "", event_time: item.event_time || "", venue: item.venue || "" }); setFormError(""); setIsFormOpen(true); };
  const closeForm = () => { const original = announcements.find((a) => a.id === editingId); const initial = editingId ? { title: original?.title, details: original?.details, category: original?.category, event_date: original?.event_date?.slice(0, 10) || "", event_time: original?.event_time || "", venue: original?.venue || "" } : emptyForm; if (JSON.stringify(form) !== JSON.stringify(initial) && !window.confirm("Discard your unsaved changes?")) return; setIsFormOpen(false); };
  const beginSave = (publish) => {
    if (publish && form.event_date && form.event_date < manilaToday()) {
      setFormError("An announcement with a past event date cannot be published. Choose today or a future date.");
      return;
    }
    setFormError(""); setPending({ type: "save", publish });
  };
  const execute = async () => {
    if (!pending || saving) return; const action = pending; setSaving(true);
    try {
      if (action.type === "save") {
        let id = editingId;
        const body = { ...form, event_date: form.event_date || null, event_time: form.event_time || null, venue: form.venue || null };
        if (id) await api(`/${encodeURIComponent(id)}`, { method: "PATCH", body });
        else { const result = await api("", { method: "POST", body }); id = result.announcement.id; }
        if (action.publish) await api(`/${encodeURIComponent(id)}/publish`, { method: "POST" });
        toast.add({ type: "success", title: action.publish ? "Announcement published" : "Draft saved" }); setIsFormOpen(false);
      } else if (action.type === "toggle") {
        await api(`/${encodeURIComponent(action.item.id)}/${action.item.status === "published" ? "unpublish" : "publish"}`, { method: "POST" });
        toast.add({ type: "success", title: action.item.status === "published" ? "Announcement unpublished" : "Announcement published" });
      } else if (action.type === "delete") {
        await api(`/${encodeURIComponent(action.item.id)}`, { method: "DELETE" }); toast.add({ type: "success", title: "Announcement deleted" });
      }
      setPending(null); await load();
    } catch (e) { toast.add({ type: "error", title: "Could not save announcement", description: e.message }); } finally { setSaving(false); }
  };
  const visible = useMemo(() => announcements, [announcements]);

  return <div className="space-y-4">
    <section className="flex flex-col justify-between gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--gf-green-tint-2) text-(--gf-green)"><Megaphone size={16} /></div><h2 className="text-[15px] font-bold text-(--gf-green)">Barangay announcements</h2></div><p className="mt-2 max-w-xl text-[10px] text-slate-500">Publish community updates, advisories, and events for residents.</p></div><button type="button" onClick={openCreate} className="flex items-center justify-center gap-2 rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-semibold text-white"><Plus size={14} /> Create announcement</button></section>
    <section className="rounded-lg border border-[#e2e8eb] bg-white p-3"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex gap-1">{["All", "Published", "Draft"].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded px-3 py-1.5 text-[10px] font-semibold ${filter === item ? "bg-(--gf-green) text-white" : "text-slate-500 hover:bg-(--gf-green-soft)"}`}>{item}</button>)}</div><label className="flex h-8 items-center gap-2 rounded-md border px-2 text-[10px] text-slate-400 sm:w-[220px]"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search announcements" placeholder="Search announcements..." className="w-full outline-none" /></label></div>
      {error && <div role="alert" className="mt-3 rounded bg-red-50 p-3 text-xs text-red-700">{error} <button onClick={load} className="underline">Retry</button></div>}
      <div className="mt-3 space-y-2">{loading ? <p className="p-8 text-center text-xs text-slate-500">Loading announcements…</p> : visible.length ? visible.map((item) => <article key={item.id} className="rounded-md border border-[#e5eaed] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold text-[#263246]">{item.title}</h3><span className={`rounded px-2 py-1 text-[8px] font-semibold ${item.status === "published" ? "bg-(--gf-green-tint-2) text-(--gf-green)" : "bg-[#fff1c6] text-[#d68d00]"}`}>{item.status}</span><span className="rounded bg-slate-100 px-2 py-1 text-[8px] text-slate-600">{item.category}</span></div><p className="mt-1 whitespace-pre-wrap text-[10px] text-slate-600">{item.details}</p><div className="mt-2 flex flex-wrap gap-3 text-[9px] text-slate-400"><span><CalendarDays size={11} className="inline" /> {formatDate(item.event_date)}</span>{item.event_time && <span><Clock3 size={11} className="inline" /> {formatTime(item.event_time)}</span>}{item.venue && <span>{item.venue}</span>}<span>Updated {new Date(item.updated_at).toLocaleDateString()}</span></div></div><div className="flex gap-1"><button onClick={() => edit(item)} className="flex items-center gap-1 rounded border px-2 py-1.5 text-[9px]"><Edit3 size={12} />Edit</button><button onClick={() => setPending({ type: "toggle", item })} className="flex items-center gap-1 rounded border px-2 py-1.5 text-[9px]"><Archive size={12} />{item.status === "published" ? "Unpublish" : "Publish"}</button><button onClick={() => setPending({ type: "delete", item })} aria-label="Delete announcement" className="rounded border px-2 py-1.5 text-red-700"><Trash2 size={12} /></button></div></div></article>) : <p className="rounded border border-dashed p-10 text-center text-xs text-slate-500">No announcements yet.</p>}</div>
    </section>
    {isFormOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4"><div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[15px] font-bold text-(--gf-green)">{editingId ? "Edit announcement" : "Create announcement"}</h2><p className="mt-1 text-[10px] text-slate-400">Required details are marked below.</p></div><button type="button" onClick={closeForm} aria-label="Close announcement form" className="text-slate-400"><X size={17} /></button></div><form onSubmit={(e) => { e.preventDefault(); beginSave(false); }} className="space-y-3"><label className="block text-[10px] font-semibold">Title<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-xs" /></label><label className="block text-[10px] font-semibold">Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-xs">{catalog.categories.map((c) => <option key={c}>{c}</option>)}</select></label><label className="block text-[10px] font-semibold">Details<textarea required maxLength={10000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="mt-1 min-h-20 w-full rounded border px-3 py-2 text-xs" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-semibold">Event date<input type="date" min={manilaToday()} value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-xs" /></label><label className="block text-[10px] font-semibold">Event time<input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-xs" /></label></div><label className="block text-[10px] font-semibold">Venue<input maxLength={200} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-xs" /></label>{formError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" disabled={saving} onClick={closeForm} className="rounded border border-slate-200 px-3 py-2 text-[10px] text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="rounded-md bg-sky-100 px-3 py-2 text-[10px] font-semibold text-sky-800 hover:bg-sky-200">Save as draft</button><button type="button" disabled={saving} onClick={() => beginSave(true)} className="rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-semibold text-white hover:brightness-95">Publish</button></div></form></div></div>}
    <ConfirmationDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) setPending(null); }} onConfirm={execute} title={pending?.type === "save" ? pending.publish ? "Publish announcement?" : "Save this announcement as a draft?" : pending?.type === "delete" ? "Delete announcement?" : pending?.item?.status === "published" ? "Unpublish announcement?" : "Publish announcement?"} description={pending?.type === "save" ? pending.publish ? `“${form.title}” will appear on the Barangay Announcements feed.` : "It will not be visible to residents." : pending?.type === "delete" ? `“${pending.item?.title}” will be archived.` : pending?.item?.status === "published" ? "This will remove it from the public feed." : `“${pending?.item?.title}” will appear on the public feed.`} confirmLabel={pending?.type === "delete" ? "Delete" : pending?.type === "save" ? pending.publish ? "Publish" : "Save draft" : pending?.item?.status === "published" ? "Unpublish" : "Publish"} confirmVariant={pending?.type === "delete" || pending?.item?.status === "published" ? "destructive" : undefined} />
  </div>;
}
