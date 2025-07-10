import { Logger } from '../types/common.js';
import { Infrastructure } from './infrastructure.js';
import { Inventory } from '../inventory/inventory.js';
import { Variables } from '../templating/variables.js';
import { OrbitConfig } from '../config/orbit-config.js';
import { LoggerFactory } from '../logging/logger-factory.js';

export interface InfrastructureContextOptions {
  infrastructure: Infrastructure;
  logger?: Logger;
}

export class InfrastructureContext {
  public readonly inventory: Inventory;
  public readonly variables: Variables;
  public readonly settings: OrbitConfig;
  public readonly logger: Logger;

  constructor(private options: InfrastructureContextOptions) {
    this.inventory = options.infrastructure.inventory;
    this.variables = options.infrastructure.variables;
    this.settings = options.infrastructure.settings;

    this.logger = options.logger || LoggerFactory.createLogger({
      format: this.settings.logFormat || 'simple',
      level: this.settings.logLevel || 'info',
    });
  }

  getVariable(name: string): any {
    return this.variables.get(name);
  }

  setVariable(name: string, value: any): void {
    this.variables.set(name, value);
  }

  getSetting<K extends keyof OrbitConfig>(name: K): OrbitConfig[K] {
    return this.settings[name];
  }

  trace(message: string, meta?: Record<string, any>): void {
    this.logger.trace(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }
}
