import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPinned } from "lucide-react";
import AboutSection from "../features/landing/components/AboutSection";
import AccomplishmentsSection from "../features/landing/components/AccomplishmentsSection";
import GetInvolvedSection from "../features/landing/components/GetInvolvedSection";
import HowItWorksSection from "../features/landing/components/HowItWorksSection";
import LiveStatusCard from "../features/landing/components/LiveStatusCard";
import MapPreviewSection from "../features/landing/components/MapPreviewSection";
import QuickReportModal from "../features/landing/components/QuickReportModal";
import ServicesSection from "../features/landing/components/ServicesSection";
import StatBand from "../shared/components/StatBand";
import Reveal from "../shared/components/Reveal";
import { BRAND, CAPSTONE_STATS } from "../features/landing/data/landingData";
import { PATHS } from "../router/paths";
export default function HomePage(){const[reportOpen,setReportOpen]=useState(false);useEffect(()=>{const open=()=>setReportOpen(true);addEventListener('geofix:open-report',open);return()=>removeEventListener('geofix:open-report',open)},[]);return <div className="landing-page"><section className="landing-hero"><div className="site-container landing-hero__inner"><Reveal className="landing-hero__copy"><p className="landing-eyebrow landing-hero__kicker">{BRAND.tagline}</p><h1 className="landing-display">A clearer way to care for our community.</h1><p>GeoFix 167 connects residents and barangay responders through location-aware reporting, coordinated service, and transparent community progress.</p><div className="landing-hero__actions"><button type="button" onClick={()=>setReportOpen(true)} className="landing-btn landing-btn--emergency"><AlertTriangle size={17}/>Report incident now</button><Link to={PATHS.publicMap} className="landing-btn landing-btn--light">Explore live map <MapPinned size={17}/></Link></div></Reveal><Reveal delay={120} className="landing-hero__visual"><LiveStatusCard/></Reveal></div></section><StatBand stats={CAPSTONE_STATS}/><HowItWorksSection/><AboutSection preview/><MapPreviewSection/><ServicesSection preview/><AccomplishmentsSection preview/><GetInvolvedSection/><QuickReportModal isOpen={reportOpen} onClose={()=>setReportOpen(false)} defaultCoordinates={null}/></div>}
