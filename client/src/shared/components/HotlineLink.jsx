import { BRAND } from "../../features/landing/data/landingData";

export default function HotlineLink({ children, number = BRAND.hotline }) {
  return (
    <a href={"tel:" + number.replace(/[ -]/g, "")} aria-label="Call Barangay hall hotline"
      className="hover:underline focus-visible:underline focus-visible:outline-2">
      {children}{number}
    </a>
  );
}
