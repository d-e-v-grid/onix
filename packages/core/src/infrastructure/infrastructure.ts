import { Task } from '../tasks/task.js';
import { Playbook } from '../playbooks/playbook.js';
import { Inventory } from '../inventory/inventory.js';
import { OnixConfig } from '../config/onix-config.js';
import { Variables } from '../templating/variables.js';
import { TemplateLoader } from './loaders/template-loader.js';

export interface InfrastructureOptions {
  inventory: Inventory;
  playbooks: Record<string, Playbook>;
  tasks: Record<string, Task>;
  templates?: TemplateLoader;
  variables: Variables;
  settings: OnixConfig;
}

export class Infrastructure {
  public readonly inventory: Inventory;
  public readonly playbooks: Record<string, Playbook>;
  public readonly tasks: Record<string, Task>;
  public readonly templates?: TemplateLoader;
  public readonly variables: Variables;
  public readonly settings: OnixConfig;

  constructor(options: InfrastructureOptions) {
    this.inventory = options.inventory;
    this.playbooks = options.playbooks;
    this.tasks = options.tasks;
    this.templates = options.templates;
    this.variables = options.variables;
    this.settings = options.settings;
  }
}
