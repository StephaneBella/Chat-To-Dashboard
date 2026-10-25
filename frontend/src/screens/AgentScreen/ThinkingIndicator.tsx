import { useEffect, useState } from "react";

const MESSAGES = [
  "Analyse de la question…",
  "Interrogation de l’entrepôt…",
  "Préparation de la visualisation…",
  "Synthèse de la réponse…",
];

export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 1400);
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-outline-variant/60 bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-[12px] text-on-surface">
          {MESSAGES[index]}
        </span>
        {elapsed >= 3 && (
          <span className="text-[10px] text-outline">
            {elapsed}s
          </span>
        )}
      </div>
    </div>
  );
}
