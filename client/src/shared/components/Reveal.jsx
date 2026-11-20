import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.14, rootMargin: "0px 0px -40px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <Tag ref={ref} style={{ "--reveal-delay": `${delay}ms` }} className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`}>{children}</Tag>;
}
