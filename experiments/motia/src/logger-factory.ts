import { randomUUID } from 'crypto'
import { Logger, LogListener } from './logger'
import { StreamAdapter } from './streams/adapters/stream-adapter'
import { Log } from './streams/logs-stream'

type CreateLogger = {
  traceId: string
  flows?: string[]
  stepName: string
}

export interface LoggerFactory {
  create: (args: CreateLogger) => Logger
}

export class BaseLoggerFactory implements LoggerFactory {
  constructor(
    private readonly isVerbose: boolean,
    private readonly logStream: StreamAdapter<Log>,
  ) {}

  create({ stepName, traceId, flows }: CreateLogger): Logger {
    const streamListener: LogListener = (level, msg, args) => {
      const id = randomUUID()

      this.logStream.set('default', id, {
        id,
        ...(args ?? {}),
        level,
        time: Date.now(),
        msg,
        traceId,
        flows: flows ?? [],
      })
    }

    return new Logger(this.isVerbose, { traceId, flows, step: stepName }, [streamListener])
  }
}
