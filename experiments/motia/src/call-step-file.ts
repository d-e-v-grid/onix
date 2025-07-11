import path from 'path'
import { trackEvent } from './analytics/utils'
import { Motia } from './motia'
import { ProcessManager } from './process-communication/process-manager'
import { Event, Step } from './types'
import { BaseStreamItem } from './types-stream'
import { isAllowedToEmit } from './utils'
import { Logger } from './logger'
import { Tracer } from './observability'
import { TraceError } from './observability/types'

type StateGetInput = { traceId: string; key: string }
type StateSetInput = { traceId: string; key: string; value: unknown }
type StateDeleteInput = { traceId: string; key: string }
type StateClearInput = { traceId: string }

type StateStreamGetInput = { groupId: string; id: string }
type StateStreamMutateInput = { groupId: string; id: string; data: BaseStreamItem }

const getLanguageBasedRunner = (
  stepFilePath = '',
): {
  command: string
  runner: string
  args: string[]
} => {
  const isPython = stepFilePath.endsWith('.py')
  const isRuby = stepFilePath.endsWith('.rb')
  const isNode = stepFilePath.endsWith('.js') || stepFilePath.endsWith('.ts')

  if (isPython) {
    const pythonRunner = path.join(__dirname, 'python', 'python-runner.py')
    return { runner: pythonRunner, command: 'python', args: [] }
  } else if (isRuby) {
    const rubyRunner = path.join(__dirname, 'ruby', 'ruby-runner.rb')
    return { runner: rubyRunner, command: 'ruby', args: [] }
  } else if (isNode) {
    if (process.env._MOTIA_TEST_MODE === 'true') {
      const nodeRunner = path.join(__dirname, 'node', 'node-runner.ts')
      return { runner: nodeRunner, command: 'node', args: ['-r', 'ts-node/register'] }
    }

    const nodeRunner = path.join(__dirname, 'node', 'node-runner.js')
    return { runner: nodeRunner, command: 'node', args: [] }
  }

  throw Error(`Unsupported file extension ${stepFilePath}`)
}

type CallStepFileOptions = {
  step: Step
  traceId: string
  data?: unknown
  contextInFirstArg?: boolean
  logger: Logger
  tracer: Tracer
}

export const callStepFile = <TData>(options: CallStepFileOptions, motia: Motia): Promise<TData | undefined> => {
  const { step, traceId, data, tracer, logger, contextInFirstArg = false } = options

  const flows = step.config.flows

  return new Promise((resolve, reject) => {
    const streamConfig = motia.lockedData.getStreams()
    const streams = Object.keys(streamConfig).map((name) => ({ name }))
    const jsonData = JSON.stringify({ data, flows, traceId, contextInFirstArg, streams })
    const { runner, command, args } = getLanguageBasedRunner(step.filePath)
    let result: TData | undefined

    const processManager = new ProcessManager({
      command,
      args: [...args, runner, step.filePath, jsonData],
      logger,
      context: 'StepExecution',
    })

    trackEvent('step_execution_started', { language: command, type: step.config.type, streams: streams.length })

    processManager
      .spawn()
      .then(() => {
        processManager.handler<TraceError | undefined>('close', async (err) => {
          processManager.kill()

          if (err) {
            trackEvent('step_execution_error', {
              stepName: step.config.name,
              traceId,
              message: err.message,
            })
          }

          if (err) {
            tracer.end({
              message: err.message,
              code: err.code,
              stack: err.stack?.replace(new RegExp(`${motia.lockedData.baseDir}/`), ''),
            })
          } else {
            tracer.end()
          }
        })
        processManager.handler<unknown>('log', async (input: unknown) => logger.log(input))

        processManager.handler<StateGetInput, unknown>('state.get', async (input) => {
          tracer.stateOperation('get', input)
          return motia.state.get(input.traceId, input.key)
        })

        processManager.handler<StateSetInput, unknown>('state.set', async (input) => {
          tracer.stateOperation('set', { traceId: input.traceId, key: input.key, value: true })
          return motia.state.set(input.traceId, input.key, input.value)
        })

        processManager.handler<StateDeleteInput, unknown>('state.delete', async (input) => {
          tracer.stateOperation('delete', input)
          return motia.state.delete(input.traceId, input.key)
        })

        processManager.handler<StateClearInput, void>('state.clear', async (input) => {
          tracer.stateOperation('clear', input)
          return motia.state.clear(input.traceId)
        })

        processManager.handler<StateStreamGetInput>(`state.getGroup`, (input) => {
          tracer.stateOperation('getGroup', input)
          return motia.state.getGroup(input.groupId)
        })

        processManager.handler<TData, void>('result', async (input) => {
          result = input
        })

        processManager.handler<Event, unknown>('emit', async (input) => {
          const flows = step.config.flows

          if (!isAllowedToEmit(step, input.topic)) {
            tracer.emitOperation(input.topic, input.data, false)
            return motia.printer.printInvalidEmit(step, input.topic)
          }

          tracer.emitOperation(input.topic, input.data, true)
          return motia.eventManager.emit({ ...input, traceId, flows, logger, tracer }, step.filePath)
        })

        Object.entries(streamConfig).forEach(([name, streamFactory]) => {
          const stateStream = streamFactory()

          processManager.handler<StateStreamGetInput>(`streams.${name}.get`, async (input) => {
            tracer.streamOperation(name, 'get', input)
            return stateStream.get(input.groupId, input.id)
          })

          processManager.handler<StateStreamMutateInput>(`streams.${name}.set`, async (input) => {
            tracer.streamOperation(name, 'set', { groupId: input.groupId, id: input.id, data: true })
            return stateStream.set(input.groupId, input.id, input.data)
          })

          processManager.handler<StateStreamGetInput>(`streams.${name}.delete`, async (input) => {
            tracer.streamOperation(name, 'delete', input)
            return stateStream.delete(input.groupId, input.id)
          })

          processManager.handler<StateStreamGetInput>(`streams.${name}.getGroup`, async (input) => {
            tracer.streamOperation(name, 'getGroup', input)
            return stateStream.getGroup(input.groupId)
          })
        })

        processManager.onStdout((data) => {
          try {
            const message = JSON.parse(data.toString())
            logger.log(message)
          } catch {
            logger.info(Buffer.from(data).toString())
          }
        })

        processManager.onStderr((data) => logger.error(Buffer.from(data).toString()))

        processManager.onProcessClose((code) => {
          processManager.close()

          if (code !== 0 && code !== null) {
            const error = { message: `Process exited with code ${code}`, code }
            tracer.end(error)
            trackEvent('step_execution_error', { stepName: step.config.name, traceId, code })
            reject(`Process exited with code ${code}`)
          } else {
            tracer.end()
            resolve(result)
          }
        })

        processManager.onProcessError((error) => {
          processManager.close()
          tracer.end({
            message: error.message,
            code: error.code,
            stack: error.stack,
          })

          if (error.code === 'ENOENT') {
            trackEvent('step_execution_error', {
              stepName: step.config.name,
              traceId,
              code: error.code,
              message: error.message,
            })
            reject(`Executable ${command} not found`)
          } else {
            reject(error)
          }
        })
      })
      .catch((error) => {
        tracer.end({
          message: error.message,
          code: error.code,
          stack: error.stack,
        })

        trackEvent('step_execution_error', {
          stepName: step.config.name,
          traceId,
          code: error.code,
          message: error.message,
        })
        reject(`Failed to spawn process: ${error}`)
      })
  })
}
