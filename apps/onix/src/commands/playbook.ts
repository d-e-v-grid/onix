import { Command } from 'commander';
import { OnixContext } from '@onix-js/core';

export const playbookCommand = (program: Command, context: OnixContext) => {
  const pbCommand = program.command('playbook').description('Manage playbooks');

  pbCommand
    .command('list')
    .description('List all available playbooks')
    .action(() => {
      console.table(Object.keys(context.variables.get('playbooks')));
    });
};
