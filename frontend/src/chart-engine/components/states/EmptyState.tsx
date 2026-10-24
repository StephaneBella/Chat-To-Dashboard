export function EmptyState({
  message = "Aucune donnée pour ce graphique.",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-on-surface-variant">
      <span className="text-3xl">∅</span>
      <span>{message}</span>
    </div>
  );
}
