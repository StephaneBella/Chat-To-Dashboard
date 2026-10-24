"""Checkpointer & long term memory"""

import re
import sqlite3
from functools import lru_cache

from django.conf import settings
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver

from chattodashboard.models import AgentMemory

MAX_CONTENT = 500
KINDS = tuple(AgentMemory.KINDS)

# 1. Short-term memory: Langgraph checkpointer (one thread = one chat)
@lru_cache(maxsize=1)
def get_checkpointer():
    """One only connexion shared by all the process"""
    conn = sqlite3.connect(str(settings.AGENT_CHECKPOINT_DB), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL") # Simultaneous reading and writing
    return SqliteSaver(conn)


def thread_config(thread_id, user_id):
    """Config to share to agent.invoke(), user_id is useful for memory tools."""
    return {"configurable": {"thread_id": str(thread_id), "user_id": user_id}}

def message_text(content):
    """A message content is actually a char or a bloc list"""
    if isinstance(content, str):
        return content
    return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")

def get_history(thread_id):
    """Availables messages (user + agent) for one thread, for the frontend"""
    tup = get_checkpointer().get_tuple({"configurable": {"thread_id": str(thread_id)}})
    if not tup:
        return []
    history = []
    
    for m in tup.checkpoint["channel_values"].get("messages", []):
        if isinstance(m, (HumanMessage, AIMessage)):
            text = message_text(m.content).strip()
            #ignore the tools call messages witouth text
            if text:
                history.append({"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": text})
    
    return history

def delete_thread(thread):
    """Delete the LangGraph thread, then the ChatThread line"""
    get_checkpointer().delete_thread(str(thread.id))
    thread.delete()




# 2. Long Term memory : Django Table
class LongTermMemory:
    def __init__(self, user_id):
        self.qs = AgentMemory.objects.filter(user_id=user_id)
        self.user_id = user_id

    def save(self, kind, content):
        """Return (memory, created). An identic content isn't duplicated."""
        content = content.strip()
        if kind not in KINDS:
            raise ValueError(f"kind doit valoir : {', '.join(KINDS)}")
        if not content:
            raise ValueError("Contenu vide.")
        if len(content) > MAX_CONTENT:
            raise ValueError(f"Contenu trop long ({MAX_CONTENT} caractères max).")
        return AgentMemory.objects.get_or_create(user_id=self.user_id, kind=kind, content=content)

    def preferences(self, limit=10):
        return list(self.qs.filter(kind="preference")[:limit])

    def search(self, query, kind=None, limit=5):
        """Key word search : sufficient for a few hundred memories."""
        qs = self.qs.filter(kind=kind) if kind else self.qs
        words = {w for w in re.findall(r"\w{3,}", query.lower())}
        scored = []
        for m in qs[:500]:
            score = sum(w in m.content.lower() for w in words)
            if score:
                scored.append((score, m))
        
        scored.sort(key=lambda s: s[0], reverse=True)
        return [m for _, m in scored[:limit]]

    def forget(self, memory_id):
        return self.qs.filter(pk=memory_id).delete()[0] > 0


def preferences_message(user_id):
    """Text to inject for a thread creation (None if there is nothing)."""
    prefs = LongTermMemory(user_id).preferences()
    if not prefs:
        return None
    return "Préférences de l'utilisateur :\n" + "\n".join(f"- {p.content}" for p in prefs)

def user_id_(config):
    return (config or {}).get("configurable", {}).get("user_id")


