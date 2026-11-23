import { useEffect, useState } from "react";

export const SHOW_SAMPLE_BADGE = true;

/** @typedef {{id: string, categories: string[], location: string, team: string, reported: string, dispatched: string, arrived: string, resolved: string, responseMinutes: number, outcome: string}} CompletedTask */

/** @type {CompletedTask[]} */
export const bdrrmoTasksSample = [
  ["001", ["Fire Incident"], "Rizal Street", "2026-11-23T08:00:00+08:00", 6, 48, "Small kitchen fire extinguished and the area checked."],
  ["002", ["Medical Emergency"], "Quezon Avenue", "2026-11-22T10:15:00+08:00", 8, 35, "First aid provided and patient handed over for medical care."],
  ["003", ["Drainage / Flooding"], "Magsaysay Boulevard", "2026-11-20T14:30:00+08:00", 12, 90, "Residents assisted through floodwater and the affected section secured."],
  ["004", ["Road Accident", "Medical Emergency"], "Bonifacio Street", "2026-11-18T16:05:00+08:00", 7, 55, "Injured road user assisted and the roadway cleared."],
  ["005", ["Fire Incident", "Electrical / Power Hazard"], "Del Pilar Road", "2026-11-15T19:20:00+08:00", 9, 62, "Electrical fire contained and the area isolated for repair."],
  ["006", ["Medical Emergency"], "California Village", "2026-11-12T07:40:00+08:00", 5, 30, "Resident stabilized and transferred to receiving medical staff."],
  ["007", ["Road Accident"], "East Berkeley Street", "2026-10-28T11:00:00+08:00", 10, 44, "Collision scene secured and traffic flow restored."],
  ["008", ["Drainage / Flooding"], "Rizal Street", "2026-10-23T15:10:00+08:00", 14, 105, "Stranded residents assisted and water level monitored until safe."],
  ["009", ["Medical Emergency"], "Quezon Avenue", "2026-10-18T09:30:00+08:00", 6, 32, "First aid completed and medical handover recorded."],
  ["010", ["Fire Incident"], "Bonifacio Street", "2026-10-12T18:45:00+08:00", 8, 58, "Outdoor fire extinguished and nearby structures inspected."],
].map(([id, categories, street, reported, responseMinutes, duration, outcome], index) => {
  const source = Date.parse(reported);
  return {
    id: "SAMPLE-167-" + id, categories, location: street + ", Barangay 167, Caloocan",
    team: "Fictional Response Team " + (index % 2 ? "B" : "A"),
    reported, dispatched: new Date(source + 2 * 60000).toISOString(),
    arrived: new Date(source + responseMinutes * 60000).toISOString(),
    resolved: new Date(source + duration * 60000).toISOString(),
    responseMinutes,
    outcome,
  };
});

export function useCompletedTasks() {
  const [state, setState] = useState({ tasks: [], loading: true });
  useEffect(() => {
    let active = true;
    Promise.resolve(bdrrmoTasksSample).then(tasks => {
      if (active) setState({ tasks, loading: false });
    });
    return () => { active = false; };
  }, []);
  return state;
}
