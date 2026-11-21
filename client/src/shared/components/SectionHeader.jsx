import { Link } from "react-router-dom";

export default function SectionHeader({ number, eyebrow, title, lead, link, linkLabel = "View all" }) {
  return <div className="landing-section-head">
    <div><p className="landing-eyebrow"><span>{number}</span>{eyebrow}</p><h2 className="landing-display">{title}</h2>{lead && <p>{lead}</p>}</div>
    {link && <Link to={link} className="landing-text-link">{linkLabel} →</Link>}
  </div>;
}
