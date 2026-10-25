import { useEffect, useRef, useState } from "react";

interface UseTypewriterOptions {
  speed?: number;
  enabled?: boolean;
}

export function useTypewriter(text: string, options: UseTypewriterOptions = {}) {
  const { speed = 18, enabled = true } = options;
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
    lastRef.current = 0;

    const words = text.split(/(\s+)/);

    const tick = (time: number) => {
      if (lastRef.current === 0) lastRef.current = time;
      const elapsed = time - lastRef.current;
      if (elapsed >= speed) {
        lastRef.current = time;
        if (indexRef.current < words.length) {
          indexRef.current += 1;
          setDisplayed(words.slice(0, indexRef.current).join(""));
        }
        if (indexRef.current >= words.length) {
          setDone(true);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, speed, enabled]);

  const skip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setDisplayed(text);
    setDone(true);
  };

  return { displayed, done, skip };
}
