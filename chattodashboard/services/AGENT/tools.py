from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from .memory import user_id_, KINDS, LongTermMemory



# Memories tools
@tool
def memory_search(query: str, kind: str | None = None, config: RunnableConfig = None) -> list[dict] | str:
    """Searches the user's long-term memory using natural language.
    Useful for retrieving an SQL query that has already been validated for a similar question.
    kind: 'preference' or 'validated_query'."""
    
    user_id = user_id_(config)
    if user_id is None:
        return "Mémoire indisponible (utilisateur non identifié)."

    if kind is not None and kind not in KINDS:
        return f"kind doit valoir : {', '.join(KINDS)}"
    
    found = LongTermMemory(user_id).search(query, kind)
    return [{"kind": m.kind, "content": m.content, "created_at": m.created_at.isoformat()} for m in found]


@tool
def memory_save(kind: str, content: str, config: RunnableConfig = None) -> dict | str:
    """Stores persistent information for future conversations.
    kind 'preference': the user's stable preference (format, unit, tone).
    kind 'validated_query': question + SQL query validated by the user.
    Never include numbers derived from the data or sensitive personal information."""

    user_id = user_id_(config)
    if user_id is None:
        return "Mémoire indisponible (utilisateur non identifié)."
    try:
        memory, created = LongTermMemory(user_id).save(kind, content)
    except ValueError as exc:
        return f"Refusé : {exc}"

    return {"saved": True, "id": memory.id, "already_known": not created}


