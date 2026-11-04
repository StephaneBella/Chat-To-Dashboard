"""Small helpers to run independent, I/O-bound tasks concurrently."""

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from django.db import close_old_connections

DEFAULT_WORKERS = 6

_executor = None
_executor_lock = threading.Lock()


def _get_executor(max_workers: int = DEFAULT_WORKERS) -> ThreadPoolExecutor:
    """One long-lived pool: worker threads keep their DB connections alive."""
    global _executor
    if _executor is None:
        with _executor_lock:
            if _executor is None:
                _executor = ThreadPoolExecutor(
                    max_workers=max_workers,
                    thread_name_prefix="dw-parallel",
                )
    return _executor


def run_parallel(tasks: dict[str, Callable], max_workers: int | None = None) -> dict:
    """Run independent callables at the same time and return {name: result}.

    The pool is shared for the whole process so each worker reuses its own
    Django connection instead of opening a new one for every query.
    """

    if not tasks:
        return {}

    def safe_call(fn: Callable):
        # Drop the connection only if it is stale/expired (CONN_MAX_AGE).
        close_old_connections()
        return fn()

    executor = _get_executor(max_workers or DEFAULT_WORKERS)
    futures = {executor.submit(safe_call, fn): name for name, fn in tasks.items()}
    results = {}
    for future in as_completed(futures):
        results[futures[future]] = future.result()
    return results
