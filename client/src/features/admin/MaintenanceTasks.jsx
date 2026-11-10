import { useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";

const tasks = [
  {
    id: "TASK-001",
    issue: "Pothole",
    location: "Rizal Street",
    team: "Team Alpha",
    priority: "High",
    dateAssigned: "April 23, 2026",
    deadline: "April 28, 2026",
    status: "In Progress",
  },
  {
    id: "TASK-002",
    issue: "Broken Streetlight",
    location: "Quezon Avenue",
    team: "Engineering Crew B",
    priority: "High",
    dateAssigned: "April 21, 2026",
    deadline: "April 25, 2026",
    status: "In Progress",
  },
  {
    id: "TASK-003",
    issue: "Clogged Drainage",
    location: "Magsaysay Blvd",
    team: "Barangay Sanitizers",
    priority: "Medium",
    dateAssigned: "April 20, 2026",
    deadline: "April 24, 2026",
    status: "Verified Fixed",
  },
];

const statusStyles = {
  "In Progress": "bg-[#dcefe5] text-primary",
  "Verified Fixed": "bg-[#d9f7e4] text-primary",
};

const priorityStyles = {
  High: "text-[#f59e0b]",
  Medium: "text-[#60738f]",
};

export default function MaintenanceTasks() {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All Priorities");
  const [team, setTeam] = useState("All Teams");

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQuery =
        !normalizedQuery ||
        [task.id, task.issue, task.location, task.team, task.status]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesPriority = priority === "All Priorities" || task.priority === priority;
      const matchesTeam = team === "All Teams" || task.team === team;
      return matchesQuery && matchesPriority && matchesTeam;
    });
  }, [priority, query, team]);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-3 sm:flex-row sm:items-center">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2 text-[10px] text-slate-400">
          <Search size={14} />
          <input
            aria-label="Search tasks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, teams, locations..."
            className="w-full outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className="h-8 rounded-md border border-border bg-white px-2 text-[10px] text-primary outline-none"
        >
          <option>All Priorities</option>
          <option>High</option>
          <option>Medium</option>
        </select>
        <select
          aria-label="Filter by team"
          value={team}
          onChange={(event) => setTeam(event.target.value)}
          className="h-8 rounded-md border border-border bg-white px-2 text-[10px] text-primary outline-none"
        >
          <option>All Teams</option>
          <option>Team Alpha</option>
          <option>Engineering Crew B</option>
          <option>Barangay Sanitizers</option>
        </select>
        <button type="button" className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-3 text-[10px] font-bold text-primary-foreground hover:opacity-90">
          <Plus size={13} /> Assign New Task
        </button>
      </section>

      <section className="rounded-lg border border-border bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-bold text-primary">
            Active Barangay Infrastructure Tasks ({filteredTasks.length})
          </h2>
          <button type="button" className="inline-flex items-center gap-1 rounded border border-[#d9e8df] px-2 py-1 text-[9px] font-semibold text-primary">
            <Download size={11} /> Export Active Tasks
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[9px]">
            <thead>
              <tr className="bg-[#f5f8fa] text-slate-500">
                {["Task ID", "Issue", "Location", "Assigned Team", "Priority", "Date Assigned", "Deadline", "Status", "Action"].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-semibold first:rounded-l last:rounded-r">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b border-[#e7ecef] last:border-0">
                  <td className="px-3 py-3 font-bold text-primary">{task.id}</td>
                  <td className="px-3 py-3 font-medium">{task.issue}</td>
                  <td className="px-3 py-3 text-slate-500">{task.location}</td>
                  <td className="px-3 py-3 font-medium text-primary">{task.team}</td>
                  <td className={`px-3 py-3 font-semibold ${priorityStyles[task.priority]}`}>{task.priority}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{task.dateAssigned}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{task.deadline}</td>
                  <td className="px-3 py-3">
                    <span className={`whitespace-nowrap rounded px-2 py-1 text-[8px] font-semibold ${statusStyles[task.status]}`}>{task.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" className="rounded bg-primary px-2 py-1 text-[8px] font-semibold text-primary-foreground hover:opacity-90">Update</button>
                  </td>
                </tr>
              ))}
              {!filteredTasks.length && (
                <tr>
                  <td colSpan="9" className="px-3 py-8 text-center text-slate-400">No maintenance tasks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}