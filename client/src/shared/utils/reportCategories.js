export function reportCategories(report) {
  let values = report.categories;
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch { values = []; }
  }
  const primary = report.category || report.incident_category;
  return [...new Set([primary, ...(Array.isArray(values) ? values : [])].filter(value => typeof value === "string" && value))];
}
