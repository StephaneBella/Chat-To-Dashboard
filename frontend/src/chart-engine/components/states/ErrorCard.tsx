export interface ErrorCardProps {
  title?: string;
  message: string;
  issues?: string[];
}

export function ErrorCard({
  title = "Graphique indisponible",
  message,
  issues = [],
}: ErrorCardProps) {
  return (
    <div className="flex h-full min-h-64 flex-col justify-center gap-2 rounded-lg border border-error/40 bg-error-container/25 p-6 text-error">
      <strong className="text-lg">{title}</strong>
      <p className="text-sm text-error/90">{message}</p>
      {issues.length > 0 && (
        <ul className="list-disc pl-5 font-mono text-xs text-error/70">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
