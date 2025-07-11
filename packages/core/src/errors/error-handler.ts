import { OnixError } from './error.js';
import { Logger, ErrorHandler } from '../types/common.js';
import { OnixEvent, OnixEvents } from '../events/onix-events.js';

export class OnixErrorHandler implements ErrorHandler {
  constructor(private logger: Logger) { }

  public handleError(error: Error, context?: Record<string, any>): void {
    if (error instanceof OnixError) {
      this.logger.error(`[${error.code}] ${error.message}`, { ...error.details, context });
    } else {
      this.logger.error(`Unhandled error: ${error.message}`, { stack: error.stack, context });
    }

    OnixEvents.emit(OnixEvent.ErrorOccurred, { error, context });
  }
}
