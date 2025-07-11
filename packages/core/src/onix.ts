import { Playbook } from './playbooks/playbook.js';
import { Inventory } from './inventory/inventory.js';
import { Variables } from './templating/variables.js';
import { LoggerFactory } from './logging/logger-factory.js';
import { OnixErrorHandler } from './errors/error-handler.js';
import { OnixConfig, defaultOnixConfig } from './config/onix-config.js';
import { Logger, OnixContext, AlertingService } from './types/common.js';
import { DefaultAlertingService } from './alerting/default-alerting-service.js';

export class Onix {
  public readonly inventory: Inventory;
  public readonly context: OnixContext;
  private readonly logger: Logger;

  constructor(config?: OnixConfig, alertingService?: AlertingService) {
    const mergedConfig = { ...defaultOnixConfig, ...config };
    const variables = new Variables({ playbooks: {} });
    this.logger = LoggerFactory.createLogger({
      format: mergedConfig.logFormat,
      level: mergedConfig.logLevel,
    });

    this.inventory = new Inventory();
    this.context = {
      variables,
      config: mergedConfig,
      logger: this.logger,
      errorHandler: new OnixErrorHandler(this.logger),
      alertingService: alertingService || new DefaultAlertingService(this.logger),
    };

    this.logger.info('Onix initialized', { config: mergedConfig });
  }

  registerPlaybook(name: string, playbook: Playbook): void {
    const playbooks = this.context.variables.get('playbooks');
    this.context.variables.set('playbooks', {
      ...playbooks,
      [name]: playbook,
    });
  }

  getPlaybook(name: string): Playbook | undefined {
    const playbooks = this.context.variables.get('playbooks');
    return playbooks ? (playbooks[name] as Playbook) : undefined;
  }
} 