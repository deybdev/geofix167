import { reportCategories } from "../utils/reportCategories";
export default function ReportCategories({ report }) {
  const categories = reportCategories(report);
  return <span title={categories.join("; ")} className="inline-flex flex-wrap items-center gap-1">
    <span>{categories[0] || "Uncategorized"}</span>
    {categories.length > 1 && <span aria-label={categories.slice(1).join(", ")} className="rounded bg-slate-100 px-1 text-xs font-semibold">+{categories.length - 1}</span>}
  </span>;
}
