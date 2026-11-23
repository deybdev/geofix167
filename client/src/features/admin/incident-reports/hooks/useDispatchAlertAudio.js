import { useEffect, useRef, useState } from "react";

export default function useDispatchAlertAudio(activeAlerts = []) {
  const audioRef = useRef(null);
  const seenRef = useRef(new Set());
  const lastPulseRef = useRef(0);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);

  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio("/sounds/dispatch-buzzer.mp3.wav");
    audioRef.current.preload = "auto";
  }

  const unlock = () => {
    if (!enabled || !audioRef.current) return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    const result = audio.play();
    if (result && typeof result.catch === "function") {
      result.then(() => {
        audio.pause();
        audio.currentTime = 0;
        setBlocked(false);
      }).catch(() => setBlocked(true));
    }
  };

  const play = () => {
    if (!enabled || !audioRef.current) return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    const result = audio.play();
    if (result && typeof result.catch === "function") {
      result.catch(() => setBlocked(true));
    }
  };

  useEffect(() => {
    const unlockOnInteraction = () => unlock();
    window.addEventListener("pointerdown", unlockOnInteraction, { once: true });
    window.addEventListener("keydown", unlockOnInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockOnInteraction);
      window.removeEventListener("keydown", unlockOnInteraction);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !activeAlerts.length) return;

    const ids = new Set(activeAlerts.map((alert) => alert.id));
    activeAlerts.forEach((alert) => {
      if (seenRef.current.has(alert.id)) return;
      seenRef.current.add(alert.id);
      if (alert.remainingSeconds <= 60) play();
    });
    seenRef.current.forEach((id) => {
      if (!ids.has(id)) seenRef.current.delete(id);
    });

    const lowest = Math.min(...activeAlerts.map((alert) => alert.remainingSeconds));
    const now = Date.now();
    if (lowest <= 10 && lowest >= 1) {
      if (now - lastPulseRef.current >= 1000) {
        lastPulseRef.current = now;
        play();
      }
    } else if (lowest <= 30 && lowest >= 11) {
      if (now - lastPulseRef.current >= 5000) {
        lastPulseRef.current = now;
        play();
      }
    }
  }, [activeAlerts, enabled]);

  const toggle = () => {
    setEnabled((current) => {
      const next = !current;
      if (next) {
        setBlocked(false);
        window.setTimeout(() => unlock(), 0);
      }
      return next;
    });
  };

  return { enabled, blocked, toggle, unlock };
}
