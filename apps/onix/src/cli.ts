import { Command } from 'commander';

import {
  Onix,
  Logger,
  LoggerLevel,
  StructuredLogger,
  ConfigLoader,
  LogFormat,
  OrbitConfig,
  JsonLogFormatter,
  SimpleLogFormatter
} from '@onix-js/core';
import { deployCommand } from './commands/deploy.js';
import { metricsCommand } from './commands/metrics.js';
import { playbookCommand } from './commands/playbook.js';
import { inventoryCommand } from './commands/inventory.js';

const program = new Command();

program
  .name('onix')
  .description('Onix CLI for infrastructure management and automation')
  .version('1.0.0')
  .option('-c, --config <path>', 'Specify path to configuration file')
  .option('-l, --log-level <level>', 'Specify log level (trace, debug, info, warn, error)')
  .option('-f, --log-format <format>', 'Log format (json, simple)', 'simple')
  .option('-d, --dry-run', 'Execute playbooks in dry-run mode');

program.parse(process.argv);
const options = program.opts();

const config: OrbitConfig = options["config"]
  ? ConfigLoader.loadFromFile(options["config"])
  : ConfigLoader.loadFromEnv();

if (options["logLevel"]) {
  config.logLevel = options["logLevel"] as LoggerLevel;
}

if (options["dryRun"] !== undefined) {
  config.dryRun = options["dryRun"];
}

if (options["logFormat"]) {
  config.logFormat = options["logFormat"] as LogFormat;
}

// Динамическое определение формата логирования
const logFormatter = config.logFormat === 'json'
  ? new JsonLogFormatter()
  : new SimpleLogFormatter();

const logger: Logger = new StructuredLogger(logFormatter, config.logLevel);

logger.info('Onix CLI initialized', { config });

const onix = new Onix(config);
const inventory = onix.inventory;
const context = onix.context;

deployCommand(program, context, inventory);
inventoryCommand(program, inventory);
playbookCommand(program, context);
metricsCommand(program);
