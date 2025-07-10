// Экспорт основного класса Onix
export { Onix } from './onix.js';

// Основные классы
export { Playbook } from './playbooks/playbook.js';
export { Inventory } from './inventory/inventory.js';
export { Variables } from './templating/variables.js';
export { LoggerFactory } from './logging/logger-factory.js';
export { OrbitErrorHandler } from './errors/error-handler.js';
export { DefaultAlertingService } from './alerting/default-alerting-service.js';

// Задачи
export { Task, TaskOptions } from './tasks/task.js';
export { ShellTask, ShellTaskOptions } from './tasks/shell-task.js';
export { CopyTask, CopyTaskOptions } from './tasks/copy-task.js';
export { CompositeTask } from './tasks/composite-task.js';
export { SSHTaskExecutor, SSHExecutorOptions } from './tasks/ssh-task-executor.js';

// Инвентарь
export { Host, HostConfig } from './inventory/host.js';
export { Group } from './inventory/group.js';

// Выполнение
export { Executor, ExecutionOptions } from './execution/executor.js';
export { Command, CommandOptions, CommandResult } from './execution/command.js';
export { SSHClient } from './execution/ssh-client.js';
export { SSHClientFactory } from './execution/ssh-client-factory.js';
export { MockSSHClient } from './execution/mock-ssh-client.js';

// Логирование
export { StructuredLogger } from './logging/logger.js';
export { LogFormatter, JsonLogFormatter, SimpleLogFormatter } from './logging/log-formatter.js';
export { metricsRegistry, taskCounter, taskDuration, playbookCounter, errorCounter } from './logging/metrics.js';

// Ошибки
export { OrbitError } from './errors/error.js';
export { RetryPolicy, RetryPolicyOptions } from './errors/retry-policy.js';

// События
export { OrbitEvent, OrbitEvents, ErrorEventPayload, TaskEventPayload, PlaybookEventPayload } from './events/orbit-events.js';

// Модули
export { Module, ModuleOptions } from './modules/module.js';
export { ModuleRegistry } from './modules/module-registry.js';

// Инфраструктура
export { Infrastructure, InfrastructureOptions } from './infrastructure/infrastructure.js';
export { InfrastructureLoader } from './infrastructure/infrastructure-loader.js';
export { InfrastructureContext, InfrastructureContextOptions } from './infrastructure/infrastructure-context.js';

// Загрузчики
export { ConfigLoader } from './config/config-loader.js';
export { InfrastructureConfigLoader } from './infrastructure/loaders/config-loader.js';
export { InventoryLoader } from './infrastructure/loaders/inventory-loader.js';
export { PlaybookLoader } from './infrastructure/loaders/playbook-loader.js';
export { TaskLoader } from './infrastructure/loaders/task-loader.js';
export { TemplateLoader, Template } from './infrastructure/loaders/template-loader.js';

// Шаблонизация
export { TemplateEngine } from './templating/template-engine.js';

// Утилиты
export { FileLoader } from './utils/file-loader.js';

// Playbook Runner
export { PlaybookRunner } from './playbooks/playbook-runner.js';

// SSH типы
export { SSHConnectionOptions, SSHCommandResult, SSHCommandOptions, ISSHClient } from './types/ssh.js';

// Общие типы
export { OrbitResult, LoggerLevel, AlertDetails, ErrorHandler, Logger, OrbitContext, AlertingService } from './types/common.js';
export { OrbitConfig, LogFormat, defaultOrbitConfig } from './config/orbit-config.js';
