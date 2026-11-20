import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function SectionHeader({ number, eyebrow, title, lead, to, linkLabel = "View all", align = "left" }) {
  return <div className={`landing-section-heading ${align === "center" ? "text-center" : ""}`}>
    <div className={`landing-section-heading__meta ${align === "center" ? "justify-center" : ""}`}><span>{number}</span><span>{eyebrow}</span></div>
    <div className={`mt-4 flex flex-col gap-4 ${align === "center" ? "items-center" : "md:flex-row md:items-end md:justify-between"}`}>
      <div><h2 className="landing-display text-3xl sm:text-4xl">{title}</h2>{lead && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{lead}</p>}</div>
      {to && <Link to={to} className="landing-text-link shrink-0">{linkLabel}<ArrowRight size={14} /></Link>}
    </div>
  </div>;
}
