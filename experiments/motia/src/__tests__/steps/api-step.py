
config = {
    "type": "api",
    "name": "api-step", 
    "emits": ["TEST_EVENT"],
    "path": "/test",
    "method": "POST"
}


async def handler(_, context):
    await context.emit({
        "data": {"test": "data"},
        "topic": "TEST_EVENT"
    })
    
    return {
        "status": 200,
        "body": {"traceId": context.trace_id}
    }
