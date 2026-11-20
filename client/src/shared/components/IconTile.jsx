export default function IconTile({ icon: Icon, tone = "green", className = "" }) {
  return <span className={`landing-icon-tile landing-icon-tile--${tone} ${className}`}><Icon size={19} strokeWidth={1.8} /></span>;
}
