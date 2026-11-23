import { useEffect, useState } from "react";
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => { const max = document.documentElement.scrollHeight - innerHeight; setProgress(max > 0 ? scrollY / max : 0); };
    update(); addEventListener("scroll", update, { passive: true }); addEventListener("resize", update);
    return () => { removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, []);
  return <span className="landing-scroll-progress" style={{ transform: `scaleX(${progress})` }} />;
}
