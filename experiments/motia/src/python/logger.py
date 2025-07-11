import time
from typing import Any, Dict, Optional
from rpc import RpcSender

class Logger:
    def __init__(self, trace_id: str, flows: list[str], rpc: RpcSender):
        self.trace_id = trace_id
        self.flows = flows
        self.rpc = rpc

    def _log(self, level: str, message: str, args: Optional[Dict[str, Any]] = None) -> None:
        log_entry = {
            "level": level,
            "time": int(time.time() * 1000),
            "traceId": self.trace_id,
            "flows": self.flows,
            "msg": message
        }

        if args:
            # Use our serializer to ensure args are JSON-serializable
            if hasattr(args, '__dict__'):
                args = vars(args)
            elif not isinstance(args, dict):
                args = {"data": args}
            log_entry.update(args)

        self.rpc.send_no_wait('log', log_entry)

    def info(self, message: str, args: Optional[Any] = None) -> None:
        self._log("info", message, args)

    def error(self, message: str, args: Optional[Any] = None) -> None:
        self._log("error", message, args)

    def debug(self, message: str, args: Optional[Any] = None) -> None:
        self._log("debug", message, args)

    def warn(self, message: str, args: Optional[Any] = None) -> None:
        self._log("warn", message, args)
