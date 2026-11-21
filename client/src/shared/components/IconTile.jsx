export default function IconTile({ icon: Icon, emergency = false }) { return <span className={`landing-icon-tile ${emergency ? "is-emergency" : ""}`}><Icon size={20} /></span>; }
