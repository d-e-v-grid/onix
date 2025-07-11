export type LogFormat = 'json' | 'simple';

export interface OnixConfig {
  name?: string;
  description?: string;

  // Inventory
  inventory?: {
    hosts: string;
    groups: string;
  };

  // Variables
  variables?: string[];

  // Playbooks
  playbooksPath?: string;

  // Logging & Execution settings
  logPath?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  logFormat?: LogFormat;

  dryRun?: boolean;
  parallelLimit?: number;
  defaultTimeout?: number;

  alertingEnabled?: boolean;
}

export const defaultOnixConfig: OnixConfig = {
  parallelLimit: 5,
  defaultTimeout: 30000,
  dryRun: false,
  logLevel: 'info',
  logFormat: 'simple',
  alertingEnabled: false,
};
