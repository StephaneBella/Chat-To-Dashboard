export function LoadingState() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-outline">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      <span className="text-[12px] font-medium">Chargement du graphique…</span>
    </div>
  );
}
