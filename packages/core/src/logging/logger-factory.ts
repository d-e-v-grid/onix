import { StructuredLogger } from './logger.js';
import { Logger, LoggerLevel } from '../types/common.js';
import { LogFormatter, JsonLogFormatter, SimpleLogFormatter } from './log-formatter.js';

export type LoggerFormat = 'json' | 'simple';

export interface LoggerFactoryOptions {
  format?: LoggerFormat;
  level?: LoggerLevel;
}

export class LoggerFactory {
  static createLogger(options?: LoggerFactoryOptions): Logger {
    const formatter: LogFormatter = options?.format === 'json'
      ? new JsonLogFormatter()
      : new SimpleLogFormatter();

    return new StructuredLogger(formatter, options?.level || 'info');
  }
}
