import { Step } from '../types'
import { Trace, TraceGroup } from './types'

export const createTrace = (traceGroup: TraceGroup, step: Step) => {
  const id = crypto.randomUUID()
  const trace: Trace = {
    id,
    name: step.config.name,
    correlationId: traceGroup.correlationId,
    parentTraceId: traceGroup.id,
    status: 'running',
    startTime: Date.now(),
    endTime: undefined,
    entryPoint: { type: step.config.type, stepName: step.config.name },
    events: [],
  }

  traceGroup.metadata.totalSteps++
  traceGroup.metadata.activeSteps++

  return trace
}
