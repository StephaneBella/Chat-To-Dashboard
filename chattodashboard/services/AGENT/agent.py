"""Build the AI agent. Exposes run_agent (sync) and astream_agent (async, streaming)."""
import asyncio
import logging
import time

from django.conf import settings
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware

from .memory import (
    apreferences_message,
    get_async_checkpointer,
    get_checkpointer,
    message_text,
    preferences_message,
    thread_config,
)
from .prompts import SYSTEM_PROMPT
from .results_store import pop_charts
from .tools import agent_tools

logger = logging.getLogger(__name__)
ALL_TOOLS = [*agent_tools]

FALL_BACK_ANSWER = (
    "Je n'ai pas réussi à formuler une réponse complète. "
    "Peux-tu reformuler ou préciser ta question ?"
)

TOOL_LABELS = {
    "get_schema": "Je consulte le dictionnaire de données…",
    "get_kpi": "Je calcule l'indicateur…",
    "run_sql": "J'interroge l'entrepôt de données…",
    "make_chart": "Je prépare le graphique…",
    "memory_search": "Je consulte ma mémoire…",
    "memory_save": "J'enregistre ta préférence…",
}


class AgentError(Exception):
    """L'agent n'a pas pu répondre (LLM indisponible, erreur interne...)."""


class AgentBusy(Exception):
    """Trop de questions en cours : il faut réessayer."""


def _with_preferences(prefs):
    return f"{SYSTEM_PROMPT}\n\n{prefs}" if prefs else SYSTEM_PROMPT


def build_system_prompt(user_id=None):
    """System prompt + user preferences (read at each query)."""
    return _with_preferences(preferences_message(user_id) if user_id else None)


def build_agent(system_prompt=SYSTEM_PROMPT, checkpointer=None):
    """
    Build the agent. Called at each question: only the prompt changes (preferences),
    the graph compilation is fast and the checkpointer is shared.
    """
    return create_agent(
        model=settings.AGENT_MODEL,
        tools=ALL_TOOLS,
        system_prompt=system_prompt,
        checkpointer=checkpointer if checkpointer is not None else get_checkpointer(),
        middleware=[
            # Stops the agent if it loops: it answers with the data it has instead.
            ModelCallLimitMiddleware(run_limit=settings.AGENT_MAX_MODEL_CALLS, exit_behavior="end"),
        ],
    )


def _config(thread_id, user_id):
    config = thread_config(thread_id, user_id)
    config["recursion_limit"] = settings.AGENT_RECURSION_LIMIT
    return config


# ---------------------------------------------------------------------------
# Synchronous version (Browsable API, tests)
# ---------------------------------------------------------------------------
def run_agent(message, thread, user_id):
    """
    One question -> {"answer": str, "chart": dict | None}.
    Raises AgentError if the agent fails.
    """
    thread_id = str(thread.id)
    pop_charts(thread_id)  # discards a possible remnant of an interrupted request

    agent = build_agent(build_system_prompt(user_id))
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": message}]}, _config(thread_id, user_id))
    except Exception as exc:
        logger.exception("Agent en échec (thread %s)", thread_id)
        raise AgentError(str(exc)) from exc

    charts = pop_charts(thread_id)
    answer = message_text(result["messages"][-1].content).strip() or FALL_BACK_ANSWER
    # The prompt asks for one chart per answer: if there are several, the last one wins
    return {"answer": answer, "chart": charts[-1] if charts else None}


# ---------------------------------------------------------------------------
# Asynchronous version (streaming)
# ---------------------------------------------------------------------------
_async_slots = None


def _slots():
    """Limits simultaneous questions (protects against the provider's rate limits)."""
    global _async_slots
    if _async_slots is None:
        _async_slots = asyncio.Semaphore(settings.AGENT_MAX_CONCURRENT_RUNS)
    return _async_slots


def _translate(mode, chunk, started):
    """Turns a LangGraph stream chunk into events. Returns (events, final text or None)."""
    events, final_text = [], None
    if mode == "messages":
        token, meta = chunk
        if meta.get("langgraph_node") == "model":      # print(meta) once to check the node name
            text = message_text(token.content)
            if text:
                events.append(("token", {"text": text}))
    elif mode == "updates":
        for node, update in chunk.items():
            msgs = update.get("messages") if isinstance(update, dict) else None
            for msg in msgs if isinstance(msgs, list) else []:
                calls = getattr(msg, "tool_calls", None)
                if calls:
                    events += [
                        ("status", {"tool": c["name"], "label": TOOL_LABELS.get(c["name"], "Je travaille…")})
                        for c in calls
                    ]
                elif getattr(msg, "type", "") == "ai":
                    final_text = message_text(msg.content)
                logger.info("[%.1fs] %s : %s", time.perf_counter() - started, node,
                            getattr(msg, "name", None) or msg.type)
    return events, final_text


async def astream_agent(message, thread, user_id):
    """
    Async generator of events (name, data):
      status : a tool is about to run   {"tool", "label"}
      token  : a piece of text          {"text"}
      done   : end                      {"answer", "chart"}
    Raises AgentBusy or AgentError.
    """
    slots = _slots()
    try:
        await asyncio.wait_for(slots.acquire(), timeout=settings.AGENT_QUEUE_TIMEOUT)
    except asyncio.TimeoutError:
        raise AgentBusy()
    try:
        thread_id = str(thread.id)
        await asyncio.to_thread(pop_charts, thread_id)       # file cache: kept off the event loop

        prefs = await apreferences_message(user_id)
        agent = build_agent(_with_preferences(prefs), checkpointer=await get_async_checkpointer())

        final_text, started = "", time.perf_counter()
        try:
            async for mode, chunk in agent.astream(
                {"messages": [{"role": "user", "content": message}]},
                _config(thread_id, user_id),
                stream_mode=["updates", "messages"],
            ):
                events, text = _translate(mode, chunk, started)
                if text is not None:
                    final_text = text
                for event in events:
                    yield event
        except Exception as exc:
            logger.exception("Agent en échec (thread %s)", thread_id)
            raise AgentError(str(exc)) from exc

        charts = await asyncio.to_thread(pop_charts, thread_id)
        yield "done", {"answer": final_text.strip() or FALL_BACK_ANSWER, "chart": charts[-1] if charts else None}
    finally:
        slots.release()