import { CheckCheck, MapPin, Radio, SearchCheck, ShieldCheck } from "lucide-react";
import Reveal from "../../../shared/components/Reveal";
import SectionHeader from "../../../shared/components/SectionHeader";
import IconTile from "../../../shared/components/IconTile";

const steps = [
  ["01", "Report", "Pin the exact location and add clear evidence.", MapPin],
  ["02", "Validate", "Barangay officers review urgency and location.", SearchCheck],
  ["03", "Dispatch", "The appropriate response unit is coordinated.", Radio],
  ["04", "Resolve", "Responders complete the field action.", CheckCheck],
  ["05", "Verify", "QR and photo proof close the public record.", ShieldCheck],
];

export default function HowItWorksSection() {
  return <section className="landing-section landing-section--paper"><div className="site-container"><Reveal><SectionHeader number="02" eyebrow="How it works" title="From report to verified resolution." lead="A clear, accountable path keeps residents informed while responders focus on the work." /></Reveal><div className="landing-process mt-10">{steps.map(([number,title,desc,Icon], index) => <Reveal key={title} delay={index*60} className="landing-process__step"><span className="landing-process__number">{number}</span><IconTile icon={Icon}/><h3>{title}</h3><p>{desc}</p></Reveal>)}</div></div></section>;
}
