"""Build the AI agent, expose run_agent(message, thread_id, user_id)"""

import logging

from django.conf import settings
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware

from .tools import agent_tools
from .memory import get_checkpointer, message_text, preferences_message, thread_config
from .prompts import SYSTEM_PROMPT
from .results_store import pop_charts
from .tools import agent_tools

logger = logging.getLogger(__name__)
ALL_TOOLS = [*agent_tools]

FALL_BACK_ANSWER = (
    "Je n'ai pas réussi à formuler une réponse complète."
    "Peux-tu reformuler ou préciser ta question ?"
)


class AgentError(Exception):
    """L'agent n'a pas pu répondre (LLM indisponible, erreur interne...)."""


def build_system_prompt(user_id=None):
    """System prompt + user preferences (read at each query)"""
    prefs = preferences_message(user_id) if user_id else None
    return f"{SYSTEM_PROMPT}\n\n{prefs}" if prefs else SYSTEM_PROMPT


def build_agent(system_prompt=SYSTEM_PROMPT):
    """
    Build the agent. Called in each step : only the prompt change (preferences),
    the graph compilation is fast and the checkpointer is shared.
    """
    return create_agent(
        model=settings.AGENT_MODEL,
        tools=ALL_TOOLS,
        system_prompt=system_prompt,
        checkpointer=get_checkpointer(),
        middleware=[
            # Stop the agent if he buckles : he response with available data rather than buckle.
            ModelCallLimitMiddleware(run_limit=settings.AGENT_MAX_MODEL_CALLS, exit_behavior="end"),
        ],
    )

def run_agent(message, thread, user_id):
    """
    One question -> {"answer": str, "chart": dict | None}.
    Uses AgentError if the agent fail.
    """
    thread_id = str(thread.id)
    pop_charts(thread_id)   # Disses a possible remnant of an interrupted request

    config = thread_config(thread_id, user_id)
    config["recursion_limit"] = settings.AGENT_RECURSION_LIMIT

    agent = build_agent(build_system_prompt(user_id))
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": message}]}, config)
    except Exception as exc:
        logger.exception("Agent en échec (thread %s)", thread_id)
        raise AgentError(str(exc)) from exc

    charts = pop_charts(thread_id)
    answer = message_text(result["messages"][-1].content).strip() or FALL_BACK_ANSWER
    # The prompt ask only from one chart per response : if there is many, the last is choosen
    return {"answer": answer, "chart": charts[-1] if charts else None} 
    