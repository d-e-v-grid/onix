import { join } from 'path';
import { existsSync } from 'fs';

import { Infrastructure } from './infrastructure.js';
import { TaskLoader } from './loaders/task-loader.js';
import { Variables } from '../templating/variables.js';
import { PlaybookLoader } from './loaders/playbook-loader.js';
import { TemplateLoader } from './loaders/template-loader.js';
import { InventoryLoader } from './loaders/inventory-loader.js';
import { TemplateEngine } from '../templating/template-engine.js';
import { InfrastructureConfigLoader } from './loaders/config-loader.js';

export class InfrastructureLoader {
  static load(infraDir: string): Infrastructure {
    if (!existsSync(infraDir)) {
      throw new Error(`Infrastructure directory "${infraDir}" not found`);
    }

    // Загрузка общей конфигурации и переменных
    const configDir = join(infraDir, 'configs');
    if (!existsSync(configDir)) {
      throw new Error(`Configs directory "${configDir}" not found`);
    }
    const configLoader = new InfrastructureConfigLoader(configDir);
    configLoader.load();

    const variables = new Variables(configLoader.getSettings().variables);
    const settings = configLoader.getSettings();

    // Загрузка инвентаря
    const inventoryPath = join(infraDir, 'inventory');
    if (!existsSync(inventoryPath)) {
      throw new Error(`Inventory directory "${inventoryPath}" not found`);
    }
    const inventory = InventoryLoader.load(inventoryPath);

    // Загрузка плейбуков
    const playbooksPath = join(infraDir, 'playbooks');
    if (!existsSync(playbooksPath)) {
      throw new Error(`Playbooks directory "${playbooksPath}" not found`);
    }
    const playbooks = PlaybookLoader.load(playbooksPath);

    // Загрузка задач
    const tasksPath = join(infraDir, 'tasks');
    if (!existsSync(tasksPath)) {
      throw new Error(`Tasks directory "${tasksPath}" not found`);
    }
    const tasks = TaskLoader.load(tasksPath);

    // Загрузка шаблонов
    const templatesDir = join(infraDir, 'templates');
    const templateEngine = new TemplateEngine(variables);
    const templateLoader = new TemplateLoader(templatesDir, templateEngine);
    templateLoader.loadAll();

    // Возвращаем полностью инициализированный экземпляр Infrastructure
    return new Infrastructure({
      inventory,
      playbooks,
      tasks,
      templates: templateLoader,
      variables,
      settings,
    });
  }
}
