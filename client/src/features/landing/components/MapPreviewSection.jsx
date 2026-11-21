import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import LandingMapViewer from "./LandingMapViewer";
import { INITIAL_BDRRMO_UNITS, INITIAL_REPORTS } from "../data/landingData";
import { PATHS } from "../../../router/paths";
import SectionHeader from "../../../shared/components/SectionHeader";
export default function MapPreviewSection(){return <section className="landing-section landing-map-preview"><div className="site-container"><SectionHeader number="03" eyebrow="Live community view" title="See response activity where it happens." lead="Public reports and verified activity across Barangay 167." link={PATHS.publicMap} linkLabel="Explore live map"/><div className="landing-map-preview__grid"><div className="landing-map-preview__map"><LandingMapViewer reports={INITIAL_REPORTS} bdrrmoUnits={INITIAL_BDRRMO_UNITS}/></div><div className="landing-map-preview__list"><p className="landing-eyebrow">Recent reports</p>{INITIAL_REPORTS.slice(0,3).map(r=><div key={r.id}><MapPin size={16}/><span><strong>{r.title}</strong><small>{r.location} · {r.reportedAt}</small></span><i className={`is-${r.status}`}>{r.statusLabel}</i></div>)}<Link to={PATHS.publicMap}>View all reports <ArrowRight size={14}/></Link></div></div></div></section>}
