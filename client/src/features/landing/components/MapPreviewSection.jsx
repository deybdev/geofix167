import { ArrowRight, CircleAlert, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import LandingMapViewer from "./LandingMapViewer";
import Reveal from "../../../shared/components/Reveal";
import SectionHeader from "../../../shared/components/SectionHeader";
import { INITIAL_BDRRMO_UNITS, INITIAL_REPORTS } from "../data/landingData";
import { PATHS } from "../../../router/paths";

export default function MapPreviewSection() {
  const reports = INITIAL_REPORTS.slice(0,3);
  return <section className="landing-section landing-map-preview"><div className="site-container"><Reveal><SectionHeader number="04" eyebrow="Live map & reports" title="See what is happening around Barangay 167." lead="Explore geotagged public reports and visible response activity in one community view." to={PATHS.publicMap} linkLabel="Open full map" /></Reveal><div className="mt-9 grid gap-5 lg:grid-cols-[1.55fr_.75fr]"><Reveal className="h-[390px] lg:h-[470px]"><LandingMapViewer reports={reports} bdrrmoUnits={INITIAL_BDRRMO_UNITS}/></Reveal><div className="landing-report-list">{reports.map((report,index)=><Reveal key={report.id} delay={index*60} className="landing-report-row"><span className={`landing-report-row__icon ${report.urgency === "High" ? "is-urgent" : ""}`}>{report.urgency === "High"?<CircleAlert size={16}/>:<MapPin size={16}/>}</span><div className="min-w-0 flex-1"><span>{report.category}</span><h3>{report.title}</h3><p>{report.location} · {report.reportedAt}</p></div><span className="landing-status-chip">{report.statusLabel?.split(" - ")[0] || report.status}</span></Reveal>)}<Link to={PATHS.publicMap} className="landing-text-link mt-2 justify-center border-t border-[#dfe4d8] pt-5">View all community reports <ArrowRight size={14}/></Link></div></div></div></section>;
}
