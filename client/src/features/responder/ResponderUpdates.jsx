import { Bell, CheckCircle2, Clock3 } from "lucide-react";

const updates = [
  {
    title: "Assignment acknowledged",
    detail: "GF-018 is ready for your response.",
    time: "Today, 10:17 AM",
    icon: CheckCircle2,
  },
  {
    title: "Dispatch received",
    detail: "Traffic/Road Response Team A received a new assignment.",
    time: "Today, 10:15 AM",
    icon: Bell,
  },
  {
    title: "Availability confirmed",
    detail: "Your responder status is active.",
    time: "Yesterday, 4:30 PM",
    icon: Clock3,
  },
];

export default function ResponderUpdates() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 pb-5 pt-7 sm:px-7 sm:pt-9">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Responder dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">Updates</h1>
      </header>
      <main className="space-y-3 px-4 py-5 sm:px-7 sm:py-6">
        {updates.map(({ title, detail, time, icon: Icon }) => (
          <article key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
            <Icon className="mt-0.5 shrink-0 text-primary" size={24} />
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p>
              <p className="mt-2 text-xs font-medium text-slate-400">{time}</p>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
