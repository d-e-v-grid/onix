// Helper functions
import { Emit, Step } from 'src/types'
import { isApiStep, isCronStep, isEventStep, isNoopStep } from '../guards'
import { FlowEdge, FlowResponse, FlowStepResponse } from '../types/flows-types'
import { randomUUID } from 'crypto'
import { getStepLanguage } from '../get-step-language'
import path from 'path'
import fs from 'fs'

const getNodeComponentPath = (filePath: string): string | undefined => {
  const filePathWithoutExtension = filePath.replace(/\.[^/.]+$/, '')
  const tsxPath = filePathWithoutExtension + '.tsx'
  return fs.existsSync(tsxPath) ? tsxPath : undefined
}

const getRelativePath = (filePath: string): string => {
  const baseDir = process.cwd()
  return path.relative(baseDir, filePath)
}

const createEdge = (
  sourceId: string,
  targetId: string,
  topic: string,
  label: string | undefined,
  variant: 'event' | 'virtual',
  conditional?: boolean,
): FlowEdge => ({
  id: `${sourceId}-${targetId}`,
  source: sourceId,
  target: targetId,
  data: {
    variant,
    label,
    topic,
    labelVariant: conditional ? 'conditional' : 'default',
  },
})

const processEmit = (emit: Emit): { topic: string; label?: string; conditional?: boolean } => {
  const isString = typeof emit === 'string'

  return {
    topic: isString ? emit : emit.topic,
    label: isString ? undefined : emit.label,
    conditional: isString ? undefined : emit.conditional,
  }
}

const createEdgesForEmits = (
  sourceStep: FlowStepResponse,
  targetSteps: FlowStepResponse[],
  emits: Emit[],
  variant: 'event' | 'virtual',
): FlowEdge[] => {
  const edges: FlowEdge[] = []

  emits.forEach((emit) => {
    const { topic, label, conditional } = processEmit(emit)

    targetSteps.forEach((targetStep) => {
      if (targetStep.subscribes?.includes(topic)) {
        edges.push(createEdge(sourceStep.id, targetStep.id, topic, label, variant, conditional))
      }
    })
  })

  return edges
}

const createBaseStepResponse = (
  step: Step,
  id: string,
): Pick<FlowStepResponse, 'name' | 'description' | 'nodeComponentPath' | 'language' | 'id' | 'filePath'> => ({
  id,
  name: step.config.name,
  description: step.config.description,
  nodeComponentPath: getNodeComponentPath(step.filePath),
  filePath: getRelativePath(step.filePath),
  language: getStepLanguage(step.filePath),
})

const createApiStepResponse = (step: Step, id: string): FlowStepResponse => {
  if (!isApiStep(step)) {
    throw new Error('Attempted to create API step response with non-API step')
  }

  return {
    ...createBaseStepResponse(step, id),
    type: 'api',
    emits: step.config.emits,
    virtualEmits: step.config.virtualEmits ?? [],
    subscribes: step.config.virtualSubscribes ?? undefined,
    action: 'webhook',
    webhookUrl: `${step.config.method} ${step.config.path}`,
    bodySchema: step.config.bodySchema ?? undefined,
  }
}

const createEventStepResponse = (step: Step, id: string): FlowStepResponse => {
  if (!isEventStep(step)) {
    throw new Error('Attempted to create Event step response with non-Event step')
  }

  return {
    ...createBaseStepResponse(step, id),
    type: 'event',
    emits: step.config.emits,
    virtualEmits: step.config.virtualEmits ?? [],
    subscribes: step.config.subscribes,
  }
}

const createNoopStepResponse = (step: Step, id: string): FlowStepResponse => {
  if (!isNoopStep(step)) {
    throw new Error('Attempted to create Noop step response with non-Noop step')
  }

  return {
    ...createBaseStepResponse(step, id),
    type: 'noop',
    emits: [],
    virtualEmits: step.config.virtualEmits,
    subscribes: step.config.virtualSubscribes,
  }
}

const createCronStepResponse = (step: Step, id: string): FlowStepResponse => {
  if (!isCronStep(step)) {
    throw new Error('Attempted to create Cron step response with non-Cron step')
  }

  return {
    ...createBaseStepResponse(step, id),
    type: 'cron',
    emits: step.config.emits,
    cronExpression: step.config.cron,
  }
}

const createStepResponse = (step: Step): FlowStepResponse => {
  const id = randomUUID()

  if (isApiStep(step)) return createApiStepResponse(step, id)
  if (isEventStep(step)) return createEventStepResponse(step, id)
  if (isNoopStep(step)) return createNoopStepResponse(step, id)
  if (isCronStep(step)) return createCronStepResponse(step, id)

  throw new Error(`Unknown step type for step: ${step.config.name}`)
}

const createEdgesForStep = (sourceStep: FlowStepResponse, allSteps: FlowStepResponse[]): FlowEdge[] => {
  const regularEdges = createEdgesForEmits(sourceStep, allSteps, sourceStep.emits, 'event')
  const virtualEdges = sourceStep.virtualEmits
    ? createEdgesForEmits(sourceStep, allSteps, sourceStep.virtualEmits, 'virtual')
    : []

  return [...regularEdges, ...virtualEdges]
}

export const generateFlow = (flowId: string, flowSteps: Step[]): FlowResponse => {
  const steps = flowSteps.map(createStepResponse)
  const edges = steps.flatMap((step) => createEdgesForStep(step, steps))

  return { id: flowId, name: flowId, steps, edges }
}
