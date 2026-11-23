import HotlineLink from "../../../shared/components/HotlineLink";
import { Phone, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../../router/paths";
import { BRAND } from "../data/landingData";
import Reveal from "../../../shared/components/Reveal";
export default function GetInvolvedSection(){const navigate=useNavigate();return <section className="landing-cta-band"><div className="site-container"><Reveal className="landing-cta-band__inner"><div><p className="landing-eyebrow">{BRAND.tagline}</p><h2 className="landing-display">Help make every street safer and every response visible.</h2></div><div><button type="button" onClick={()=>navigate(PATHS.adminLogin)} className="landing-btn landing-btn--light"><Shield size={16}/>Officials portal</button><p><Phone size={14}/><HotlineLink>Hotline </HotlineLink> · Available 24/7</p></div></Reveal></div></section>}
