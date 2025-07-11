import { Step, Emit } from './types'
import { isApiStep, isCronStep, isEventStep } from './guards'

const toTopic = (emit: Emit) => (typeof emit === 'string' ? emit : emit.topic)

export const isAllowedToEmit = (step: Step, emit: string): boolean => {
  if (!isApiStep(step) && !isCronStep(step) && !isEventStep(step)) return false

  const emitsTopics = step.config.emits.map(toTopic)
  return emitsTopics.includes(emit) || emitsTopics.length === 0
}
