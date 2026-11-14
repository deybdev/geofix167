import { useState } from "react";
import { Archive, CalendarDays, Edit3, Megaphone, Plus, Search, X } from "lucide-react";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";

const initialAnnouncements = [
  {
    id: 1,
    title: "Barangay clean-up drive this Saturday",
    body: "Residents are invited to join the community clean-up drive along Rizal Street this Saturday, April 27, from 7:00 AM to 10:00 AM.",
    eventDate: "2026-04-27",
    venue: "Rizal Street",
    status: "Published",
    updated: "April 22, 2026",
  },
  {
    id: 2,
    title: "Water interruption advisory",
    body: "Water service may be interrupted in selected areas while scheduled maintenance is being completed.",
    eventDate: "2026-04-29",
    venue: "Barangay 167",
    status: "Draft",
    updated: "April 21, 2026",
  },
];

const emptyForm = { title: "", body: "", eventDate: "", venue: "" };

function formatDate(value) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const visibleAnnouncements = announcements.filter((announcement) => {
    const matchesFilter = filter === "All" || announcement.status === filter;
    const searchText = `${announcement.title} ${announcement.body} ${announcement.venue}`.toLowerCase();
    return matchesFilter && searchText.includes(query.toLowerCase());
  });

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm(announcement) {
    setPendingAction({ type: "edit", announcement });
  }

  function startEditing(announcement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      body: announcement.body,
      eventDate: announcement.eventDate,
      venue: announcement.venue,
    });
    setError("");
    setIsFormOpen(true);
  }

  function requestPublishToggle(announcement) {
    setPendingAction({ type: "publish", announcement });
  }

  function confirmPendingAction() {
    if (!pendingAction) return;

    if (pendingAction.type === "edit") {
      startEditing(pendingAction.announcement);
    } else {
      const { id } = pendingAction.announcement;
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === id
            ? {
                ...announcement,
                status: announcement.status === "Published" ? "Draft" : "Published",
                updated: "Just now",
              }
            : announcement,
        ),
      );
    }

    setPendingAction(null);
  }

  function closeForm() {
    setIsFormOpen(false);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.eventDate || !form.venue.trim()) {
      setError("Complete the title, details, event date, and venue before saving.");
      return;
    }

    if (editingId) {
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === editingId
            ? { ...announcement, ...form, updated: "Just now" }
            : announcement,
        ),
      );
    } else {
      setAnnouncements((current) => [
        {
          id: Date.now(),
          ...form,
          status: "Draft",
          updated: "Just now",
        },
        ...current,
      ]);
    }
    closeForm();
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col justify-between gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--gf-green-tint-2) text-(--gf-green)">
              <Megaphone size={16} />
            </div>
            <h2 className="text-[15px] font-bold text-(--gf-green)">Barangay announcements</h2>
          </div>
          <p className="mt-2 max-w-xl text-[10px] leading-relaxed text-slate-500">
            Publish community updates, advisories, and events for residents. Published announcements appear in the barangay community feed.
          </p>
        </div>
        <button type="button" onClick={openCreateForm} className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-semibold text-white hover:opacity-90">
          <Plus size={14} /> Create announcement
        </button>
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1">
            {["All", "Published", "Draft"].map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded px-3 py-1.5 text-[10px] font-semibold ${filter === item ? "bg-(--gf-green) text-white" : "text-slate-500 hover:bg-(--gf-green-soft)"}`}>
                {item}
              </button>
            ))}
          </div>
          <label className="flex h-8 items-center gap-2 rounded-md border border-[#dfe5e8] px-2 text-[10px] text-slate-400 sm:w-[220px]">
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search announcements" placeholder="Search announcements..." className="w-full outline-none placeholder:text-slate-400" />
          </label>
        </div>

        <div className="mt-3 space-y-2">
          {visibleAnnouncements.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#dfe5e8] px-4 py-10 text-center text-[10px] text-slate-400">No announcements match your search.</div>
          ) : visibleAnnouncements.map((announcement) => (
            <article key={announcement.id} className="rounded-md border border-[#e5eaed] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[12px] font-bold text-[#263246]">{announcement.title}</h3>
                    <span className={`rounded px-2 py-1 text-[8px] font-semibold ${announcement.status === "Published" ? "bg-(--gf-green-tint-2) text-(--gf-green)" : "bg-[#fff1c6] text-[#d68d00]"}`}>{announcement.status}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{announcement.body}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-400">
                    <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(announcement.eventDate)}</span>
                    <span>{announcement.venue}</span>
                    <span>Updated {announcement.updated}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEditForm(announcement)} className="flex items-center gap-1 rounded border border-[#dfe5e8] px-2 py-1.5 text-[9px] font-semibold text-slate-500 hover:text-(--gf-green)" title="Edit announcement"><Edit3 size={12} /> Edit</button>
                  <button type="button" onClick={() => requestPublishToggle(announcement)} className="flex items-center gap-1 rounded border border-[#dfe5e8] px-2 py-1.5 text-[9px] font-semibold text-slate-500 hover:text-(--gf-green)" title={announcement.status === "Published" ? "Unpublish announcement" : "Publish announcement"}><Archive size={12} /> {announcement.status === "Published" ? "Unpublish" : "Publish"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-(--gf-green)">{editingId ? "Edit announcement" : "Create announcement"}</h2>
                <p className="mt-1 text-[10px] text-slate-400">Required details are marked by the form fields below.</p>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close announcement form" className="text-slate-400 hover:text-slate-600"><X size={17} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-[10px] font-semibold text-slate-600">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-[#dfe5e8] px-3 text-[11px] font-normal outline-none focus:border-(--gf-green)" placeholder="Announcement title" /></label>
              <label className="block text-[10px] font-semibold text-slate-600">Details<textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="mt-1 min-h-20 w-full resize-y rounded-md border border-[#dfe5e8] px-3 py-2 text-[11px] font-normal outline-none focus:border-(--gf-green)" placeholder="Share the announcement details..." /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-semibold text-slate-600">Event date<input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-[#dfe5e8] px-3 text-[11px] font-normal outline-none focus:border-(--gf-green)" /></label>
                <label className="block text-[10px] font-semibold text-slate-600">Venue<input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-[#dfe5e8] px-3 text-[11px] font-normal outline-none focus:border-(--gf-green)" placeholder="Venue or coverage area" /></label>
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[10px] text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="rounded-md border border-[#dfe5e8] px-3 py-2 text-[10px] font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-semibold text-white">{editingId ? "Save changes" : "Save as draft"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirm={confirmPendingAction}
        title={
          pendingAction?.type === "edit"
            ? "Edit this announcement?"
            : pendingAction?.announcement?.status === "Published"
              ? "Unpublish this announcement?"
              : "Publish this announcement?"
        }
        description={
          pendingAction?.type === "edit"
            ? "You can update the announcement details before saving your changes."
            : pendingAction?.announcement?.status === "Published"
              ? "Residents will no longer see this announcement in the community feed."
              : "This announcement will become visible to residents in the community feed."
        }
        confirmLabel={pendingAction?.type === "edit" ? "Continue editing" : pendingAction?.announcement?.status === "Published" ? "Unpublish" : "Publish"}
        confirmVariant={pendingAction?.type === "edit" ? undefined : pendingAction?.announcement?.status === "Published" ? "destructive" : undefined}
      />
    </div>
  );
}
