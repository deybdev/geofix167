import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../router/paths";
export default function LiveStatusCard() {
  const [updated,setUpdated]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setUpdated(new Date()),30000);return()=>clearInterval(timer)},[]);
  return <article className="landing-live-card"><div className="landing-live-card__head"><div><p>Barangay response network</p><h2>Live operations status</h2></div><span><i /> Online</span></div><div className="landing-live-card__stats"><div><strong>24/7</strong><small>Dispatch coverage</small></div><div><strong>11.8m</strong><small>Avg. response</small></div><div><strong>98.4%</strong><small>SLA response</small></div></div><div className="landing-live-card__verified"><CheckCircle2 size={17} /><div><strong>Latest verified response</strong><span>Molave drainage cleared · QR proof logged</span></div><Clock3 size={15} /></div><p className="landing-live-card__updated">Status refreshed {updated.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p><Link to={PATHS.publicMap}>Open live map <ArrowUpRight size={15} /></Link><Radio className="landing-live-card__radio" size={100} /></article>;
}
