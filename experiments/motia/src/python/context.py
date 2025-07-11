from typing import Any, List, Optional
from type_definitions import HandlerResult
from rpc import RpcSender
from rpc_state_manager import RpcStateManager
from logger import Logger
from dot_dict import DotDict

class Context:
    def __init__(
        self,
        trace_id: str,
        flows: List[str],
        rpc: RpcSender,
        streams: DotDict,
    ):
        self.trace_id = trace_id
        self.flows = flows
        self.rpc = rpc
        self.state = RpcStateManager(rpc)
        self.streams = streams
        self.logger = Logger(self.trace_id, self.flows, rpc)

    async def emit(self, event: Any) -> Optional[HandlerResult]:
        return await self.rpc.send('emit', event)