import { OnixError } from "../errors/error.js";
import { OnixConfig } from "../config/onix-config.js";
import { Variables } from "../templating/variables.js";

export type OnixResult<T = any> = {
  success: boolean;
  data?: T;
  error?: OnixError;
};


export type LoggerLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LoggerLevel, message: string, meta?: Record<string, any>): void;
  trace(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

export interface AlertDetails {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: Record<string, any>;
}

export interface AlertingService {
  sendAlert(details: AlertDetails): Promise<void>;
}

export interface ErrorHandler {
  handleError(error: OnixError, meta?: Record<string, any>): void;
}

export interface OnixContext {
  variables: Variables;
  config: OnixConfig;
  logger: Logger;
  errorHandler: ErrorHandler;
  alertingService?: AlertingService;
}
