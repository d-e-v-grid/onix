import { Command } from 'commander';
import { metricsRegistry } from '@onix-js/core';

export const metricsCommand = (program: Command) => {
  program
    .command('metrics')
    .description('Print Prometheus metrics to stdout')
    .action(async () => {
      const metrics = await metricsRegistry.metrics();
      console.log(metrics);
    });
};