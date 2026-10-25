import { useState } from "react";
import type { ThreadSummary } from "../../api/agentChat";

interface ThreadsSidebarProps {
  threads: ThreadSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function ThreadsSidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
  loading,
}: ThreadsSidebarProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-outline-variant/60 bg-white/80">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[12px] font-semibold text-on-surface">
          Conversations
        </span>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary-container/40"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nouvelle
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {loading && threads.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-outline">Chargement...</div>
        )}
        {threads.map((thread) => (
          <div
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 ${
              activeId === thread.id
                ? "bg-primary-container/50 text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">
                {thread.title || "Conversation"}
              </p>
            </div>
            <button
              onClick={(e) => handleDelete(e, thread.id)}
              disabled={deleting === thread.id}
              className="hidden items-center justify-center rounded-lg p-1 text-outline group-hover:flex hover:text-rose-600"
            >
              <span className="material-symbols-outlined text-[16px]">
                delete
              </span>
            </button>
          </div>
        ))}
        {threads.length === 0 && !loading && (
          <div className="px-2 py-2 text-[11px] text-outline">
            Aucune conversation
          </div>
        )}
      </div>
    </aside>
  );
}
