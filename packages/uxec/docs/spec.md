# Спецификация библиотеки Unified Execution Engine

## Введение и концепция

Представьте, что вы пишете скрипт автоматизации, и вам нужно выполнить команду. Но где она должна выполниться? На локальной машине? На удаленном сервере через SSH? Внутри Docker контейнера? Традиционно для каждого случая требуются разные API и подходы. Unified Execution Engine решает эту проблему, предоставляя единый, изоморфный интерфейс для выполнения команд в любом контексте.

Основная идея заключается в том, что команда — это просто команда, независимо от того, где она выполняется. Библиотека абстрагирует детали выполнения, предоставляя разработчику привычный и удобный интерфейс, вдохновленный Google zx.

## Архитектура библиотеки

### Модульная структура

Библиотека организована по принципу модульности, где каждый тип выполнения (local, SSH, Docker) реализован как отдельный адаптер. Это позволяет легко добавлять новые типы выполнения в будущем и поддерживать tree-shaking для уменьшения размера бандла.

```
unified-exec/
├── src/
│   ├── core/
│   │   ├── execution-engine.ts      # Основной класс движка
│   │   ├── command.ts               # Модель команды
│   │   ├── result.ts                # Модель результата
│   │   ├── stream-handler.ts        # Обработка потоков
│   │   └── error.ts                 # Специализированные ошибки
│   ├── adapters/
│   │   ├── base-adapter.ts          # Базовый класс адаптера
│   │   ├── local-adapter.ts         # Локальное выполнение
│   │   ├── ssh-adapter.ts           # SSH выполнение
│   │   └── docker-adapter.ts        # Docker выполнение
│   ├── utils/
│   │   ├── shell-escape.ts          # Экранирование команд
│   │   ├── runtime-detect.ts        # Определение runtime
│   │   └── process-utils.ts         # Утилиты процессов
│   └── index.ts                     # Точка входа
```

### Основные компоненты

#### 1. ExecutionEngine - центральный координатор

Это главный класс, который управляет всеми адаптерами и предоставляет единый API. Он определяет, какой адаптер использовать, управляет конфигурацией и обеспечивает согласованность поведения.

```typescript
interface ExecutionEngineConfig {
  // Глобальные настройки
  defaultTimeout?: number;              // Таймаут по умолчанию (мс)
  defaultCwd?: string;                  // Рабочая директория по умолчанию
  defaultEnv?: Record<string, string>;  // Переменные окружения по умолчанию
  defaultShell?: string | boolean;     // Shell для выполнения команд
  
  // Настройки для адаптеров
  adapters?: {
    local?: LocalAdapterConfig;
    ssh?: SSHAdapterConfig;
    docker?: DockerAdapterConfig;
  };
  
  // Поведение
  throwOnNonZeroExit?: boolean;        // Бросать ошибку при exitCode !== 0
  encoding?: BufferEncoding;            // Кодировка для stdout/stderr
  maxBuffer?: number;                   // Максимальный размер буфера
  
  // Runtime специфичные настройки
  runtime?: {
    preferBun?: boolean;              // Предпочитать Bun если доступен
    bunPath?: string;                 // Путь к бинарнику Bun
  };
}
```

#### 2. Command - модель команды

Команда инкапсулирует всю информацию о том, что нужно выполнить. Она поддерживает как простые строковые команды, так и сложные конфигурации с пайпами и перенаправлениями.

```typescript
interface Command {
  // Основное
  command: string;                      // Команда для выполнения
  args?: string[];                      // Аргументы команды
  
  // Контекст выполнения
  cwd?: string;                         // Рабочая директория
  env?: Record<string, string>;         // Переменные окружения
  timeout?: number;                     // Таймаут выполнения
  
  // Управление потоками
  stdin?: string | Buffer | NodeJS.ReadableStream;  // Входные данные
  stdout?: 'pipe' | 'ignore' | 'inherit' | NodeJS.WritableStream;
  stderr?: 'pipe' | 'ignore' | 'inherit' | NodeJS.WritableStream;
  
  // Опции выполнения
  shell?: string | boolean;             // Использовать shell
  detached?: boolean;                   // Отсоединенный процесс
  signal?: AbortSignal;                 // Сигнал отмены
  
  // Специфичные для адаптеров
  adapter?: 'local' | 'ssh' | 'docker' | 'auto';
  adapterOptions?: AdapterSpecificOptions;
}

type AdapterSpecificOptions = 
  | { type: 'ssh'; host: string; username: string; port?: number; privateKey?: string; }
  | { type: 'docker'; container: string; user?: string; workdir?: string; }
  | { type: 'local' };
```

#### 3. ExecutionResult - результат выполнения

Результат содержит всю информацию о выполненной команде, включая выходные данные, код завершения и метаданные.

```typescript
interface ExecutionResult {
  // Основные данные
  stdout: string;                       // Стандартный вывод
  stderr: string;                       // Вывод ошибок
  exitCode: number;                     // Код завершения
  signal?: string;                      // Сигнал завершения
  
  // Метаданные
  command: string;                      // Выполненная команда
  duration: number;                     // Время выполнения (мс)
  startedAt: Date;                      // Время начала
  finishedAt: Date;                     // Время завершения
  
  // Контекст
  adapter: string;                      // Использованный адаптер
  host?: string;                        // Хост (для SSH)
  container?: string;                   // Контейнер (для Docker)
  
  // Утилиты
  toString(): string;                   // Возвращает stdout.trim()
  toJSON(): object;                     // Сериализация
  throwIfFailed(): void;                // Бросает ошибку если exitCode !== 0
}
```

### Адаптеры выполнения

#### LocalAdapter - локальное выполнение

Использует child_process из Node.js или Bun.spawn для выполнения команд на локальной машине. Поддерживает все возможности child_process, включая пайпы, сигналы и потоковую передачу данных.

```typescript
interface LocalAdapterConfig {
  // Выбор реализации
  preferBun?: boolean;                  // Использовать Bun если доступен
  forceImplementation?: 'node' | 'bun'; // Принудительный выбор
  
  // Настройки процесса
  uid?: number;                         // User ID для процесса
  gid?: number;                         // Group ID для процесса
  
  // Ограничения
  maxBuffer?: number;                   // Максимальный размер буфера
  killSignal?: string;                  // Сигнал для завершения
}
```

#### SSHAdapter - выполнение через SSH

Расширяет возможности node-ssh, добавляя поддержку потоковой передачи, мультиплексирования соединений и продвинутого управления сессиями.

```typescript
interface SSHAdapterConfig {
  // Пул соединений
  connectionPool?: {
    enabled: boolean;                   // Использовать пул
    maxConnections: number;             // Максимум соединений
    idleTimeout: number;                // Таймаут неактивности
    keepAlive: boolean;                 // Keep-alive пакеты
  };
  
  // SSH опции
  defaultConnectOptions?: {
    host?: string;
    port?: number;
    username?: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    password?: string;
    tryKeyboard?: boolean;
    readyTimeout?: number;
    strictHostKeyChecking?: boolean;
    algorithms?: {
      serverHostKey?: string[];
      cipher?: string[];
    };
  };
  
  // Мультиплексирование
  multiplexing?: {
    enabled: boolean;                   // Использовать мультиплексирование
    controlPath?: string;               // Путь к control socket
    controlPersist?: string | number;   // Время жизни master соединения
  };
  
  // Расширенные возможности
  sudo?: {
    enabled: boolean;                   // Разрешить sudo
    password?: string;                  // Пароль для sudo
    prompt?: string;                    // Промпт sudo
  };
  
  // SFTP
  sftp?: {
    enabled: boolean;                   // Включить SFTP операции
    concurrency: number;                // Параллельные операции
  };
}
```

#### DockerAdapter - выполнение в контейнерах

Использует Docker API для выполнения команд внутри контейнеров. Поддерживает как запущенные контейнеры, так и создание временных.

```typescript
interface DockerAdapterConfig {
  // Подключение к Docker
  socketPath?: string;                  // Unix socket путь
  host?: string;                        // TCP хост
  port?: number;                        // TCP порт
  version?: string;                     // Версия API
  
  // Настройки выполнения
  defaultExecOptions?: {
    User?: string;                      // Пользователь в контейнере
    WorkingDir?: string;                // Рабочая директория
    Env?: string[];                     // Переменные окружения
    Privileged?: boolean;               // Привилегированный режим
    AttachStdin?: boolean;
    AttachStdout?: boolean;
    AttachStderr?: boolean;
    Tty?: boolean;                      // Псевдо-TTY
  };
  
  // Управление контейнерами
  autoCreate?: {
    enabled: boolean;                   // Создавать временные контейнеры
    image: string;                      // Образ по умолчанию
    autoRemove: boolean;                // Удалять после выполнения
    volumes?: string[];                 // Монтирование томов
  };
}
```

### API и использование

#### Основной API - стиль zx

Библиотека предоставляет удобный API в стиле zx с поддержкой template literals:

```typescript
// Создание экземпляра движка
const $ = createExecutionEngine(config);

// Простое выполнение
const result = await $`echo "Hello, World!"`;
console.log(result.stdout); // "Hello, World!"

// С интерполяцией (автоматическое экранирование)
const filename = "my file.txt";
await $`touch ${filename}`;

// Цепочка конфигурации
const $prod = $.with({
  env: { NODE_ENV: 'production' },
  cwd: '/app'
});

// SSH выполнение
const $remote = $.ssh({
  host: 'server.example.com',
  username: 'deploy'
});
await $remote`npm install && npm run build`;

// Docker выполнение
const $docker = $.docker({
  container: 'my-app',
  workdir: '/app'
});
await $docker`python manage.py migrate`;

// Комбинирование
const files = await $`ls -la`;
await $remote`echo ${files}`;
```

#### Продвинутое использование

```typescript
// Потоковая обработка
const proc = $`tail -f /var/log/app.log`;
proc.stdout.on('data', chunk => {
  console.log('Log:', chunk.toString());
});

// Отмена выполнения
const controller = new AbortController();
const promise = $`long-running-command`.signal(controller.signal);
setTimeout(() => controller.abort(), 5000);

// Пайпы
await $`cat data.json`.pipe($`jq '.users[]'`).pipe($`wc -l`);

// Параллельное выполнение
const results = await Promise.all([
  $`npm test`,
  $`npm run lint`,
  $`npm run type-check`
]);

// Обработка ошибок
try {
  await $`exit 1`;
} catch (error) {
  if (error instanceof CommandError) {
    console.log('Exit code:', error.exitCode);
    console.log('Stderr:', error.stderr);
  }
}

// Интерактивные команды
const answer = await $`read -p "Continue? (y/n) " -n 1 -r && echo $REPLY`
  .interactive();
```

### Обработка ошибок

Библиотека предоставляет детализированную систему ошибок:

```typescript
// Базовый класс ошибок
class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
  }
}

// Специфичные ошибки
class CommandError extends ExecutionError {
  constructor(
    public readonly command: string,
    public readonly exitCode: number,
    public readonly signal: string | undefined,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly duration: number
  ) {
    super(`Command failed with exit code ${exitCode}: ${command}`, 'COMMAND_FAILED');
  }
}

class ConnectionError extends ExecutionError {
  constructor(
    public readonly host: string,
    public readonly originalError: Error
  ) {
    super(`Failed to connect to ${host}: ${originalError.message}`, 'CONNECTION_FAILED');
  }
}

class TimeoutError extends ExecutionError {
  constructor(
    public readonly command: string,
    public readonly timeout: number
  ) {
    super(`Command timed out after ${timeout}ms: ${command}`, 'TIMEOUT');
  }
}

class DockerError extends ExecutionError {
  constructor(
    public readonly container: string,
    public readonly operation: string,
    public readonly originalError: Error
  ) {
    super(`Docker operation '${operation}' failed for container ${container}`, 'DOCKER_ERROR');
  }
}
```

### Интеграция с Bun

Библиотека автоматически определяет runtime и использует оптимальные API:

```typescript
// Runtime detection
class RuntimeDetector {
  static detect(): 'node' | 'bun' | 'deno' {
    if (typeof Bun !== 'undefined') return 'bun';
    if (typeof Deno !== 'undefined') return 'deno';
    return 'node';
  }
  
  static getBunVersion(): string | null {
    if (typeof Bun === 'undefined') return null;
    return Bun.version;
  }
  
  static hasFeature(feature: 'spawn' | 'serve' | 'sqlite'): boolean {
    const runtime = this.detect();
    if (runtime === 'bun') {
      // Проверка специфичных для Bun возможностей
      switch (feature) {
        case 'spawn': return typeof Bun.spawn === 'function';
        case 'serve': return typeof Bun.serve === 'function';
        case 'sqlite': return typeof Bun.SQLite === 'function';
      }
    }
    return false;
  }
}

// Использование Bun.spawn когда доступно
class BunLocalAdapter extends BaseAdapter {
  protected async spawnProcess(command: Command): Promise<BunProcess> {
    const proc = Bun.spawn({
      cmd: this.buildCommandArray(command),
      cwd: command.cwd,
      env: { ...process.env, ...command.env },
      stdin: command.stdin,
      stdout: command.stdout || 'pipe',
      stderr: command.stderr || 'pipe'
    });
    
    return this.wrapBunProcess(proc);
  }
}
```

### Тестирование и моки

Библиотека предоставляет встроенные инструменты для тестирования:

```typescript
// Mock адаптер для тестов
class MockAdapter extends BaseAdapter {
  private responses: Map<string, MockResponse> = new Map();
  
  mockCommand(command: string | RegExp, response: MockResponse): void {
    this.responses.set(command.toString(), response);
  }
  
  async execute(command: Command): Promise<ExecutionResult> {
    const mockResponse = this.findMockResponse(command.command);
    if (!mockResponse) {
      throw new Error(`No mock defined for command: ${command.command}`);
    }
    
    // Симуляция задержки
    await this.delay(mockResponse.delay || 0);
    
    return {
      stdout: mockResponse.stdout || '',
      stderr: mockResponse.stderr || '',
      exitCode: mockResponse.exitCode || 0,
      signal: mockResponse.signal,
      command: command.command,
      duration: mockResponse.delay || 10,
      startedAt: new Date(),
      finishedAt: new Date(),
      adapter: 'mock'
    };
  }
}

// Использование в тестах
describe('MyService', () => {
  it('should deploy application', async () => {
    const $ = createExecutionEngine({ adapter: 'mock' });
    
    $.mock('git pull', { stdout: 'Already up to date.' });
    $.mock('npm install', { stdout: 'added 150 packages' });
    $.mock('npm run build', { stdout: 'Build successful' });
    
    const service = new DeploymentService($);
    const result = await service.deploy();
    
    expect(result.success).toBe(true);
    expect($.executedCommands).toEqual([
      'git pull',
      'npm install', 
      'npm run build'
    ]);
  });
});
```

### Примеры реальных сценариев

#### Сценарий 1: Деплой на несколько серверов

```typescript
async function deployToServers(servers: string[]) {
  const $ = createExecutionEngine({
    defaultTimeout: 300000, // 5 минут
    adapters: {
      ssh: {
        connectionPool: { enabled: true, maxConnections: 10 }
      }
    }
  });
  
  // Параллельный деплой с ограничением
  const results = await Promise.all(
    servers.map(async (server) => {
      const $server = $.ssh({ host: server, username: 'deploy' });
      
      try {
        // Обновление кода
        await $server`cd /app && git pull origin main`;
        
        // Установка зависимостей
        await $server`npm ci --production`;
        
        // Сборка
        await $server`npm run build`;
        
        // Грациозный рестарт
        await $server`pm2 reload app --update-env`;
        
        return { server, status: 'success' };
      } catch (error) {
        return { server, status: 'failed', error };
      }
    })
  );
  
  // Отчет
  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    throw new Error(`Deployment failed on ${failed.length} servers`);
  }
}
```

#### Сценарий 2: CI/CD пайплайн

```typescript
async function runCIPipeline() {
  const $ = createExecutionEngine();
  
  // Подготовка окружения
  const buildEnv = {
    NODE_ENV: 'test',
    CI: 'true'
  };
  
  const $ci = $.with({ env: buildEnv });
  
  // Тесты
  console.log('Running tests...');
  const testResults = await $ci`npm test -- --json`;
  const tests = JSON.parse(testResults.stdout);
  
  if (tests.numFailedTests > 0) {
    throw new Error(`${tests.numFailedTests} tests failed`);
  }
  
  // Сборка Docker образа
  console.log('Building Docker image...');
  const version = await $`git describe --tags --always`;
  const tag = `myapp:${version.stdout.trim()}`;
  
  await $`docker build -t ${tag} .`;
  
  // Запуск контейнера для интеграционных тестов
  const containerName = `test-${Date.now()}`;
  await $`docker run -d --name ${containerName} ${tag}`;
  
  try {
    // Выполнение тестов внутри контейнера
    const $container = $.docker({ container: containerName });
    await $container`./run-integration-tests.sh`;
  } finally {
    // Очистка
    await $`docker rm -f ${containerName}`;
  }
  
  // Публикация
  console.log('Publishing image...');
  await $`docker push ${tag}`;
}
```

### Производительность и оптимизации

Библиотека включает несколько оптимизаций для высокой производительности:

1. **Пул соединений для SSH** - переиспользование SSH соединений для множественных команд
2. **Ленивая загрузка адаптеров** - адаптеры загружаются только при необходимости
3. **Потоковая обработка** - поддержка больших объемов данных без загрузки в память
4. **Мультиплексирование SSH** - использование ControlMaster для ускорения соединений
5. **Кеширование Docker клиента** - переиспользование подключений к Docker daemon

### Безопасность

Библиотека уделяет особое внимание безопасности:

1. **Автоматическое экранирование** - все интерполированные значения автоматически экранируются
2. **Санитизация путей** - предотвращение path traversal атак
3. **Ограничение буферов** - защита от DoS через большие выводы
4. **Изоляция credentials** - пароли и ключи никогда не логируются
5. **Поддержка абстрактных сокетов** - для безопасного локального взаимодействия

Эта спецификация обеспечивает полное понимание архитектуры и реализации Unified Execution Engine. Библиотека создает мощную абстракцию над различными способами выполнения команд, сохраняя при этом гибкость и производительность каждого подхода.