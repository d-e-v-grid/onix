import { FileLoader } from '../utils/file-loader.js';
import { OnixConfig, defaultOnixConfig } from './onix-config.js';

export class ConfigLoader {
  static loadFromFile(path: string): OnixConfig {
    const configData = FileLoader.loadFile(path);
    return ConfigLoader.loadFromEnv({ ...defaultOnixConfig, ...configData });
  }

  // Метод для загрузки конфигурации из переменных окружения
  static loadFromEnv(config: OnixConfig = defaultOnixConfig): OnixConfig {
    const envConfig: OnixConfig = {
      parallelLimit: process.env["ORBIT_PARALLEL_LIMIT"] ? parseInt(process.env["ORBIT_PARALLEL_LIMIT"], 10) : undefined,
      defaultTimeout: process.env["ORBIT_DEFAULT_TIMEOUT"] ? parseInt(process.env["ORBIT_DEFAULT_TIMEOUT"], 10) : undefined,
      dryRun: process.env["ORBIT_DRY_RUN"] ? process.env["ORBIT_DRY_RUN"] === 'true' : undefined,
      logLevel: process.env["ORBIT_LOG_LEVEL"] as OnixConfig['logLevel'] | undefined,
      logFormat: process.env["ORBIT_LOG_FORMAT"] as OnixConfig['logFormat'] | undefined,
    };

    // Убираем неопределённые значения
    Object.keys(envConfig).forEach(
      key => envConfig[key as keyof OnixConfig] === undefined && delete envConfig[key as keyof OnixConfig]
    );

    return { ...config, ...envConfig };
  }
}
