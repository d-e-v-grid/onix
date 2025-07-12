# Техническое задание для создания проекта xs на базе uxec

## Введение и контекст

Данное техническое задание описывает процесс трансформации библиотеки Unified Execution Engine (uxec) в проект xs - полнофункциональную альтернативу Google zx с расширенными возможностями. Проект xs должен обеспечить 100% совместимость с API zx v8, при этом предоставляя дополнительные возможности благодаря архитектуре uxec.

Важно понимать, что xs не просто клон zx, а эволюция концепции скриптинга на JavaScript. Мы сохраняем всё лучшее из zx, добавляя мощные возможности удалённого выполнения, контейнеризации и оркестрации.

## Часть 1: Подготовка базовой инфраструктуры

### 1.1 Реструктуризация проекта

Первым шагом необходимо создать монорепозиторий, который будет содержать как базовую библиотеку uxec, так и новый проект xs. Это позволит нам поддерживать обе библиотеки синхронно и переиспользовать код.

**Структура директорий:**
```
workspace/
├── packages/
│   ├── uxec/              # Базовая библиотека (текущий код)
│   ├── xs/                # Новый проект xs
│   │   ├── src/
│   │   │   ├── core/      # Ядро xs, расширяющее uxec
│   │   │   ├── globals/   # Глобальные функции zx
│   │   │   ├── cli/       # CLI реализация
│   │   │   ├── compat/    # Слой совместимости с zx
│   │   │   └── plugins/   # Система плагинов
│   │   ├── tests/
│   │   ├── benchmarks/
│   │   └── package.json
│   └── xs-plugins/        # Официальные плагины
│       ├── kubernetes/
│       ├── aws/
│       └── github-actions/
├── examples/              # Примеры использования
├── docs/                  # Документация
└── pnpm-workspace.yaml
```

**Задача для Claude Code:**
1. Создать структуру монорепозитория с использованием pnpm workspaces
2. Настроить TypeScript с проектными ссылками между пакетами
3. Создать базовый package.json для xs со всеми необходимыми зависимостями из zx
4. Настроить систему сборки с использованием esbuild для оптимальной производительности

### 1.2 Создание слоя совместимости

Слой совместимости - это критически важный компонент, который обеспечит работу существующих zx скриптов без изменений. Необходимо создать маппинг между API zx и uxec.

**Файл `packages/xs/src/compat/zx-compat.ts`:**
```typescript
// Этот файл должен экспортировать все публичные API zx
// с правильными типами и поведением

import { ExecutionEngine } from '@workspace/uxec';
import type { ProcessOutput as ZxProcessOutput, ProcessPromise as ZxProcessPromise } from 'zx';

// Адаптер для преобразования ExecutionResult в ProcessOutput
export class ProcessOutputAdapter implements ZxProcessOutput {
  constructor(private result: ExecutionResult) {}
  
  get stdout(): string { return this.result.stdout; }
  get stderr(): string { return this.result.stderr; }
  get exitCode(): number { return this.result.exitCode; }
  get signal(): string | null { return this.result.signal || null; }
  
  // Важно: zx использует эти методы для строкового представления
  toString(): string { return this.stdout.trim(); }
  valueOf(): string { return this.toString(); }
  
  // Метод для получения построчного вывода
  get lines(): string[] {
    return this.stdout.split('\n').filter(line => line.length > 0);
  }
}
```

## Часть 2: Реализация основных компонентов

### 2.1 ProcessPromise - полная реализация

ProcessPromise - это сердце zx API. Текущая реализация в uxec неполная, и это первое, что нужно исправить.

**Детальная спецификация ProcessPromise:**

```typescript
export class ProcessPromise extends Promise<ProcessOutput> {
  private _stdin: Writable;
  private _stdout: Readable;
  private _stderr: Readable;
  private _command: Command;
  private _engine: ExecutionEngine;
  private _child?: ChildProcess;
  private _piped = false;
  private _quiet = false;
  private _nothrow = false;
  private _resolved = false;
  private _abortController?: AbortController;
  
  // Потоки должны быть доступны сразу после создания
  get stdin(): Writable { return this._stdin; }
  get stdout(): Readable { return this._stdout; }
  get stderr(): Readable { return this._stderr; }
  
  // Метод pipe должен поддерживать цепочки любой длины
  pipe(destination: ProcessPromise | Writable | TemplateStringsArray, ...args: any[]): ProcessPromise {
    // Если destination это template string, создаём новую команду
    if (Array.isArray(destination)) {
      const newCommand = this._engine.createProcessPromise({
        command: interpolate(destination, ...args),
        stdin: this.stdout  // Критично: stdout текущей команды становится stdin следующей
      });
      
      // Важно: нужно правильно обработать ошибки в цепочке
      this.catch(err => newCommand.kill());
      
      return newCommand;
    }
    
    // Если destination это ProcessPromise
    if (destination instanceof ProcessPromise) {
      destination._stdin = this.stdout;
      this._piped = true;
      
      // Синхронизация жизненного цикла процессов
      this.then(() => destination._stdin.end());
      this.catch(() => destination.kill());
      
      return destination;
    }
    
    // Если destination это Writable stream
    if (isWritableStream(destination)) {
      this.stdout.pipe(destination);
      return this;
    }
  }
  
  // Метод kill должен корректно завершать всю цепочку процессов
  kill(signal: string = 'SIGTERM'): void {
    if (this._child) {
      // Используем process tree kill из uxec
      ProcessUtils.killProcessTree(this._child.pid, signal);
    }
    
    this._abortController?.abort();
  }
  
  // Метод timeout с поддержкой кастомного сигнала
  timeout(ms: number, signal: string = 'SIGTERM'): ProcessPromise {
    const timer = setTimeout(() => {
      this.kill(signal);
      this._rejectWithTimeout(ms);
    }, ms);
    
    this.finally(() => clearTimeout(timer));
    return this;
  }
  
  // Quiet режим подавляет вывод, но сохраняет его в результате
  quiet(): ProcessPromise {
    this._quiet = true;
    
    // Перенаправляем потоки в /dev/null, но сохраняем данные
    const nullStream = createNullStream();
    this._stdout.pipe(nullStream);
    this._stderr.pipe(nullStream);
    
    return this;
  }
  
  // Nothrow режим превращает ошибки в обычные результаты
  nothrow(): ProcessPromise {
    this._nothrow = true;
    
    // Переопределяем обработку ошибок
    const originalThen = this.then.bind(this);
    this.then = (onfulfilled, onrejected) => {
      return originalThen(
        onfulfilled,
        (error) => {
          if (error instanceof CommandError) {
            // Преобразуем ошибку в результат
            return new ProcessOutputAdapter({
              stdout: error.stdout,
              stderr: error.stderr,
              exitCode: error.exitCode,
              signal: error.signal,
              command: error.command,
              duration: error.duration,
              startedAt: new Date(),
              finishedAt: new Date(),
              adapter: 'local'
            });
          }
          // Другие ошибки пробрасываем
          if (onrejected) return onrejected(error);
          throw error;
        }
      );
    };
    
    return this;
  }
  
  // Новые методы для удобной работы с выводом
  async text(): Promise<string> {
    const result = await this;
    return result.stdout.trim();
  }
  
  async json<T = any>(): Promise<T> {
    const text = await this.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON from command output: ${error.message}\nOutput: ${text}`);
    }
  }
  
  async buffer(): Promise<Buffer> {
    const result = await this;
    return Buffer.from(result.stdout);
  }
  
  async lines(): Promise<string[]> {
    const result = await this;
    return result.stdout.split('\n').filter(line => line.length > 0);
  }
  
  // Async iterator для построчной обработки
  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    const liner = new LineTransform();
    this.stdout.pipe(liner);
    
    for await (const line of liner) {
      yield line;
    }
  }
}
```

### 2.2 Глобальные функции и утилиты

zx предоставляет множество удобных глобальных функций. Нужно реализовать их все с учётом особенностей xs.

**Файл `packages/xs/src/globals/index.ts`:**

```typescript
// Основной экспорт $ с правильной типизацией
export const $: XsTemplate = createXsEngine();

// sleep - простая, но важная утилита
export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// cd - изменение рабочей директории с проверками
export function cd(dir: string): void {
  const resolvedPath = path.resolve(dir);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }
  
  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Not a directory: ${resolvedPath}`);
  }
  
  process.chdir(resolvedPath);
  
  // Важно: обновляем defaultCwd в движке
  $.updateConfig({ defaultCwd: resolvedPath });
}

// within - временное изменение контекста
export async function within<T>(
  callback: () => T | Promise<T>
): Promise<T> {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  
  try {
    return await callback();
  } finally {
    // Восстанавливаем оригинальное состояние
    process.chdir(originalCwd);
    process.env = originalEnv;
    $.updateConfig({ 
      defaultCwd: originalCwd,
      defaultEnv: originalEnv 
    });
  }
}

// retry с экспоненциальной задержкой
export async function retry<T>(
  count: number,
  delayOrCallback: number | string | (() => T | Promise<T>),
  callback?: () => T | Promise<T>
): Promise<T> {
  // Парсинг аргументов для поддержки разных сигнатур
  let retries = count;
  let delay = 0;
  let fn: () => T | Promise<T>;
  
  if (typeof delayOrCallback === 'function') {
    fn = delayOrCallback;
  } else {
    delay = typeof delayOrCallback === 'string' 
      ? parseDelay(delayOrCallback)  // '1s', '500ms' и т.д.
      : delayOrCallback;
    fn = callback!;
  }
  
  let lastError: Error;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < retries - 1) {
        const waitTime = delay * Math.pow(2, i); // Экспоненциальная задержка
        await sleep(waitTime);
      }
    }
  }
  
  throw new Error(`Retry failed after ${retries} attempts: ${lastError!.message}`);
}

// spinner - анимированный индикатор загрузки
export async function spinner<T>(
  messageOrCallback: string | (() => T | Promise<T>),
  callback?: () => T | Promise<T>
): Promise<T> {
  // Определяем, работаем ли мы в CI окружении
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (isCI) {
    // В CI просто выполняем callback без анимации
    const fn = typeof messageOrCallback === 'function' ? messageOrCallback : callback!;
    return await fn();
  }
  
  const message = typeof messageOrCallback === 'string' ? messageOrCallback : 'Working...';
  const fn = typeof messageOrCallback === 'function' ? messageOrCallback : callback!;
  
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  
  // Сохраняем курсор и скрываем его
  process.stdout.write('\x1B[?25l');
  
  const timer = setInterval(() => {
    process.stdout.write(`\r${frames[index]} ${message}`);
    index = (index + 1) % frames.length;
  }, 80);
  
  try {
    const result = await fn();
    clearInterval(timer);
    process.stdout.write('\r\x1B[K'); // Очищаем строку
    process.stdout.write('\x1B[?25h'); // Показываем курсор
    return result;
  } catch (error) {
    clearInterval(timer);
    process.stdout.write('\r\x1B[K');
    process.stdout.write('\x1B[?25h');
    throw error;
  }
}

// question - интерактивный ввод
export async function question(
  query: string,
  options: QuestionOptions = {}
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  // Поддержка выбора из списка
  if (options.choices) {
    console.log(query);
    options.choices.forEach((choice, index) => {
      console.log(`  ${index + 1}) ${choice}`);
    });
    
    while (true) {
      const answer = await new Promise<string>(resolve => {
        rl.question('Enter your choice: ', resolve);
      });
      
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < options.choices.length) {
        rl.close();
        return options.choices[index];
      }
      
      console.log('Invalid choice. Please try again.');
    }
  }
  
  // Поддержка маскированного ввода для паролей
  if (options.mask) {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;
      
      stdout.write(query);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      let password = '';
      
      stdin.on('data', (char) => {
        char = char.toString();
        
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write('\n');
            rl.close();
            resolve(password);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
          case '\u007f': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              stdout.write('\b \b');
            }
            break;
          default:
            password += char;
            stdout.write(options.mask);
        }
      });
    });
  }
  
  // Обычный ввод
  return new Promise(resolve => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
```

### 2.3 HTTP клиент (fetch)

zx включает fetch для удобной работы с HTTP. Нужно реализовать его с дополнительными возможностями.

```typescript
// packages/xs/src/globals/fetch.ts

import { default as nodeFetch, RequestInit, Response } from 'node-fetch';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

// Расширяем стандартный fetch дополнительными методами
export interface XsFetch {
  (url: string, init?: RequestInit): Promise<Response>;
  
  // Удобные методы для common cases
  json<T = any>(url: string, init?: RequestInit): Promise<T>;
  text(url: string, init?: RequestInit): Promise<string>;
  download(url: string, destination: string, init?: RequestInit): Promise<void>;
  
  // Методы для работы с API
  get<T = any>(url: string, init?: RequestInit): Promise<T>;
  post<T = any>(url: string, body?: any, init?: RequestInit): Promise<T>;
  put<T = any>(url: string, body?: any, init?: RequestInit): Promise<T>;
  delete<T = any>(url: string, init?: RequestInit): Promise<T>;
}

export const fetch: XsFetch = Object.assign(
  async (url: string, init?: RequestInit) => {
    // Добавляем таймаут по умолчанию
    const timeout = init?.timeout || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await nodeFetch(url, {
        ...init,
        signal: controller.signal
      });
      
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${url}`);
      }
      
      throw error;
    }
  },
  {
    // Реализация удобных методов
    async json<T = any>(url: string, init?: RequestInit): Promise<T> {
      const response = await fetch(url, init);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json() as Promise<T>;
    },
    
    async text(url: string, init?: RequestInit): Promise<string> {
      const response = await fetch(url, init);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.text();
    },
    
    async download(url: string, destination: string, init?: RequestInit): Promise<void> {
      const response = await fetch(url, init);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      await pipeline(response.body, createWriteStream(destination));
    },
    
    // RESTful методы
    async get<T = any>(url: string, init?: RequestInit): Promise<T> {
      return fetch.json<T>(url, { ...init, method: 'GET' });
    },
    
    async post<T = any>(url: string, body?: any, init?: RequestInit): Promise<T> {
      return fetch.json<T>(url, {
        ...init,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers
        },
        body: JSON.stringify(body)
      });
    },
    
    async put<T = any>(url: string, body?: any, init?: RequestInit): Promise<T> {
      return fetch.json<T>(url, {
        ...init,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers
        },
        body: JSON.stringify(body)
      });
    },
    
    async delete<T = any>(url: string, init?: RequestInit): Promise<T> {
      return fetch.json<T>(url, { ...init, method: 'DELETE' });
    }
  }
);
```

## Часть 3: Синхронный API

### 3.1 Реализация $.sync

zx v8 представил синхронный API, который очень удобен для простых скриптов. Нужно реализовать его через uxec.

```typescript
// packages/xs/src/core/sync-engine.ts

export class SyncExecutionEngine {
  private engine: ExecutionEngine;
  
  constructor(config?: ExecutionEngineConfig) {
    this.engine = new ExecutionEngine(config);
  }
  
  // Основной метод для синхронного выполнения
  sync(strings: TemplateStringsArray, ...values: any[]): SyncProcessOutput {
    const command = interpolate(strings, ...values);
    
    // Используем spawnSync для Node.js или Bun.spawnSync для Bun
    if (RuntimeDetector.isBun()) {
      return this.executeBunSync(command);
    }
    
    return this.executeNodeSync(command);
  }
  
  private executeNodeSync(command: string): SyncProcessOutput {
    const result = spawnSync(command, {
      shell: true,
      encoding: 'utf8',
      cwd: this.engine.config.defaultCwd,
      env: this.engine.config.defaultEnv,
      maxBuffer: this.engine.config.maxBuffer
    });
    
    return new SyncProcessOutput(
      result.stdout?.toString() || '',
      result.stderr?.toString() || '',
      result.status || 0,
      result.signal || null,
      command
    );
  }
  
  private executeBunSync(command: string): SyncProcessOutput {
    // @ts-ignore - Bun global
    const proc = Bun.spawnSync({
      cmd: ['sh', '-c', command],
      cwd: this.engine.config.defaultCwd,
      env: this.engine.config.defaultEnv
    });
    
    return new SyncProcessOutput(
      new TextDecoder().decode(proc.stdout),
      new TextDecoder().decode(proc.stderr),
      proc.exitCode,
      null,
      command
    );
  }
}

// Класс для результата синхронного выполнения
export class SyncProcessOutput {
  constructor(
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly exitCode: number,
    public readonly signal: string | null,
    public readonly command: string
  ) {}
  
  toString(): string {
    return this.stdout.trim();
  }
  
  valueOf(): string {
    return this.toString();
  }
  
  get text(): string {
    return this.toString();
  }
  
  get json(): any {
    return JSON.parse(this.stdout);
  }
  
  get lines(): string[] {
    return this.stdout.split('\n').filter(line => line.length > 0);
  }
  
  // Метод для проверки успешности
  get success(): boolean {
    return this.exitCode === 0;
  }
  
  // Метод для броска исключения при ошибке
  throwIfError(): void {
    if (this.exitCode !== 0) {
      const error = new Error(`Command failed: ${this.command}`);
      Object.assign(error, {
        exitCode: this.exitCode,
        signal: this.signal,
        stdout: this.stdout,
        stderr: this.stderr,
        command: this.command
      });
      throw error;
    }
  }
}
```

## Часть 4: CLI реализация

### 4.1 Основной CLI

CLI должен поддерживать все флаги zx и дополнительные возможности xs.

```typescript
// packages/xs/src/cli/index.ts

import { Command } from 'commander';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export async function createCLI(): Promise<Command> {
  const program = new Command('xs');
  
  program
    .version(getVersion())
    .description('A tool for writing better scripts - enhanced zx')
    .argument('[script]', 'Script file to execute')
    .option('-e, --eval <code>', 'Evaluate code')
    .option('-i, --interactive', 'Start REPL')
    .option('-q, --quiet', 'Suppress output')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-s, --shell <shell>', 'Custom shell binary')
    .option('--cwd <dir>', 'Set current working directory')
    .option('--env <file>', 'Load env file')
    .option('--install', 'Auto-install missing dependencies')
    .option('--ext <ext>', 'Set default extension')
    .option('--experimental', 'Enable experimental features')
    .option('--repl', 'Start interactive REPL')
    .option('--json', 'Output as JSON')
    .option('--prefer-local <path>', 'Prefer local node_modules')
    .option('--prefix <cmd>', 'Command prefix')
    .option('--postfix <cmd>', 'Command postfix')
    .option('--registry <url>', 'Custom npm registry')
    .option('--test', 'Enable test mode')
    .action(async (script, options) => {
      // Настройка глобального контекста
      await setupGlobalContext(options);
      
      if (options.interactive || options.repl) {
        // Запуск REPL
        await startRepl(options);
      } else if (options.eval) {
        // Выполнение кода из командной строки
        await evalCode(options.eval, options);
      } else if (script) {
        // Выполнение файла скрипта
        await runScript(script, options);
      } else {
        // Чтение из stdin
        await runStdin(options);
      }
    });
  
  // Дополнительные команды
  program
    .command('init')
    .description('Initialize new xs project')
    .option('-t, --template <name>', 'Use project template')
    .action(async (options) => {
      await initProject(options);
    });
  
  program
    .command('run <target>')
    .description('Run script from package.json')
    .action(async (target) => {
      await runPackageScript(target);
    });
  
  program
    .command('install-completions')
    .description('Install shell completions')
    .action(async () => {
      await installCompletions();
    });
  
  return program;
}

// Функция настройки глобального контекста
async function setupGlobalContext(options: any): Promise<void> {
  // Устанавливаем глобальные переменные
  global.$ = createXsEngine({
    verbose: options.verbose,
    quiet: options.quiet,
    shell: options.shell,
    cwd: options.cwd
  });
  
  // Все глобальные функции
  global.cd = cd;
  global.fetch = fetch;
  global.sleep = sleep;
  global.question = question;
  global.retry = retry;
  global.spinner = spinner;
  global.chalk = chalk;
  global.fs = fs;
  global.os = os;
  global.path = path;
  global.glob = glob;
  global.yaml = yaml;
  global.which = which;
  global.tmpdir = tmpdir;
  global.tmpfile = tmpfile;
  
  // Загрузка .env файла если указан
  if (options.env) {
    await loadEnvFile(options.env);
  }
  
  // Установка экспериментальных флагов
  if (options.experimental) {
    process.env.XS_EXPERIMENTAL = 'true';
  }
}

// Функция выполнения скрипта
async function runScript(scriptPath: string, options: any): Promise<void> {
  const fullPath = path.resolve(scriptPath);
  
  // Определяем тип файла
  const ext = path.extname(fullPath) || options.ext || '.mjs';
  
  // Специальная обработка для разных типов файлов
  switch (ext) {
    case '.md':
      await runMarkdownScript(fullPath);
      break;
      
    case '.yaml':
    case '.yml':
      await runYamlScript(fullPath);
      break;
      
    case '.ts':
      // Регистрируем TypeScript loader
      register('tsx/esm', pathToFileURL('./'));
      await import(fullPath);
      break;
      
    default:
      // Обычный JavaScript
      await import(fullPath);
  }
}

// Выполнение Markdown файлов
async function runMarkdownScript(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf8');
  
  // Извлекаем код из блоков ```js, ```javascript, ```ts, ```typescript
  const codeBlocks = extractCodeBlocks(content);
  
  for (const block of codeBlocks) {
    if (block.lang === 'bash' || block.lang === 'sh') {
      // Выполняем как shell команды
      await $`${block.code}`;
    } else {
      // Выполняем как JavaScript
      await evalCode(block.code, { silent: true });
    }
  }
}

// REPL реализация
async function startRepl(options: any): Promise<void> {
  const repl = createRepl({
    prompt: 'xs> ',
    useColors: true,
    terminal: true,
    breakEvalOnSigint: true
  });
  
  // Добавляем все глобальные переменные в контекст REPL
  Object.assign(repl.context, {
    $,
    cd,
    fetch,
    sleep,
    question,
    retry,
    spinner,
    chalk,
    fs,
    os,
    path,
    glob,
    yaml
  });
  
  // Кастомный eval для поддержки await на верхнем уровне
  repl.eval = (cmd, context, filename, callback) => {
    if (cmd.includes('await')) {
      cmd = `(async () => { ${cmd} })()`;
    }
    
    defaultEval(cmd, context, filename, callback);
  };
  
  // История команд
  const historyPath = path.join(os.homedir(), '.xs_history');
  repl.setupHistory(historyPath, (err) => {
    if (err) console.error('History setup failed:', err);
  });
  
  // Автодополнение для команд системы
  repl.completer = createSystemCompleter();
  
  repl.on('exit', () => {
    console.log('Goodbye!');
    process.exit(0);
  });
}
```

### 4.2 Поддержка автоустановки зависимостей

```typescript
// packages/xs/src/cli/auto-install.ts

export async function enableAutoInstall(): Promise<void> {
  const originalRequire = Module.prototype.require;
  
  Module.prototype.require = function(id: string) {
    try {
      return originalRequire.call(this, id);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log(`Installing missing dependency: ${id}`);
        
        // Определяем менеджер пакетов
        const packageManager = detectPackageManager();
        
        // Устанавливаем пакет синхронно
        const result = spawnSync(packageManager, ['add', id], {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        if (result.status === 0) {
          // Очищаем кеш require
          delete require.cache[require.resolve(id)];
          
          // Пробуем загрузить снова
          return originalRequire.call(this, id);
        }
      }
      
      throw error;
    }
  };
}

function detectPackageManager(): string {
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('bun.lockb')) return 'bun';
  return 'npm';
}
```

## Часть 5: Расширенные возможности

### 5.1 Поддержка удалённого выполнения скриптов

```typescript
// packages/xs/src/core/remote-execution.ts

export async function executeRemoteScript(url: string, options: any): Promise<void> {
  // Проверка безопасности URL
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed for remote scripts');
  }
  
  // Загрузка скрипта
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch script: ${response.statusText}`);
  }
  
  const content = await response.text();
  
  // Определение типа по content-type или расширению
  const contentType = response.headers.get('content-type');
  const ext = path.extname(parsed.pathname);
  
  // Создание временного файла для выполнения
  const tmpPath = path.join(tmpdir(), `xs-remote-${Date.now()}${ext || '.mjs'}`);
  await fs.writeFile(tmpPath, content);
  
  try {
    await runScript(tmpPath, options);
  } finally {
    // Очистка временного файла
    await fs.unlink(tmpPath);
  }
}
```

### 5.2 Интеграция с менеджерами пакетов

```typescript
// packages/xs/src/integrations/package-managers.ts

export class PackageManagerIntegration {
  private manager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  
  constructor() {
    this.manager = this.detectPackageManager();
  }
  
  // Умное выполнение скриптов из package.json
  async runScript(scriptName: string, args: string[] = []): Promise<void> {
    const packageJson = await this.readPackageJson();
    
    if (!packageJson.scripts?.[scriptName]) {
      // Проверяем, может это составной скрипт (pre/post)
      const preScript = `pre${scriptName}`;
      const postScript = `post${scriptName}`;
      
      if (packageJson.scripts?.[preScript]) {
        await this.executeScript(preScript);
      }
      
      if (!packageJson.scripts?.[scriptName]) {
        throw new Error(`Script "${scriptName}" not found in package.json`);
      }
    }
    
    await this.executeScript(scriptName, args);
    
    if (packageJson.scripts?.[`post${scriptName}`]) {
      await this.executeScript(`post${scriptName}`);
    }
  }
  
  private async executeScript(name: string, args: string[] = []): Promise<void> {
    const command = this.getRunCommand(name, args);
    
    // Используем xs движок для выполнения
    await $`${command}`;
  }
  
  private getRunCommand(script: string, args: string[]): string {
    const argsStr = args.length > 0 ? ` -- ${args.join(' ')}` : '';
    
    switch (this.manager) {
      case 'npm':
        return `npm run ${script}${argsStr}`;
      case 'yarn':
        return `yarn ${script}${argsStr}`;
      case 'pnpm':
        return `pnpm ${script}${argsStr}`;
      case 'bun':
        return `bun run ${script}${argsStr}`;
    }
  }
}
```

### 5.3 Система плагинов

```typescript
// packages/xs/src/plugins/plugin-system.ts

export interface XsPlugin {
  name: string;
  version: string;
  
  // Хуки жизненного цикла
  onLoad?(context: XsContext): void | Promise<void>;
  onBeforeExecute?(command: Command): Command | Promise<Command>;
  onAfterExecute?(result: ExecutionResult): void | Promise<void>;
  onError?(error: Error): Error | void | Promise<Error | void>;
  
  // Регистрация дополнительных возможностей
  registerCommands?(program: Command): void;
  registerGlobals?(globals: Record<string, any>): void;
  registerAdapters?(engine: ExecutionEngine): void;
}

export class PluginManager {
  private plugins: Map<string, XsPlugin> = new Map();
  private hooks: Map<string, Set<Function>> = new Map();
  
  async loadPlugin(nameOrPath: string): Promise<void> {
    let plugin: XsPlugin;
    
    if (nameOrPath.startsWith('.') || path.isAbsolute(nameOrPath)) {
      // Локальный плагин
      plugin = await import(nameOrPath);
    } else {
      // npm пакет
      const modulePath = require.resolve(nameOrPath);
      plugin = await import(modulePath);
    }
    
    this.validatePlugin(plugin);
    this.plugins.set(plugin.name, plugin);
    
    // Регистрация хуков
    if (plugin.onBeforeExecute) {
      this.addHook('beforeExecute', plugin.onBeforeExecute.bind(plugin));
    }
    
    if (plugin.onAfterExecute) {
      this.addHook('afterExecute', plugin.onAfterExecute.bind(plugin));
    }
    
    // Инициализация плагина
    if (plugin.onLoad) {
      await plugin.onLoad(this.createContext());
    }
  }
  
  private validatePlugin(plugin: any): void {
    if (!plugin.name || !plugin.version) {
      throw new Error('Plugin must have name and version properties');
    }
  }
  
  private createContext(): XsContext {
    return {
      engine: $,
      version: getVersion(),
      platform: process.platform,
      addGlobal: (name: string, value: any) => {
        global[name] = value;
      },
      addCommand: (name: string, handler: Function) => {
        // Добавление команды в CLI
      }
    };
  }
  
  async executeHook(hookName: string, ...args: any[]): Promise<any> {
    const hooks = this.hooks.get(hookName);
    if (!hooks) return args[0];
    
    let result = args[0];
    for (const hook of hooks) {
      result = await hook(result, ...args.slice(1));
      if (result === undefined) result = args[0];
    }
    
    return result;
  }
}

// Пример плагина для GitHub Actions
export const githubActionsPlugin: XsPlugin = {
  name: 'xs-github-actions',
  version: '1.0.0',
  
  onLoad(context) {
    // Добавляем специальные функции для GitHub Actions
    context.addGlobal('setOutput', (name: string, value: string) => {
      console.log(`::set-output name=${name}::${value}`);
    });
    
    context.addGlobal('setSecret', (value: string) => {
      console.log(`::add-mask::${value}`);
    });
    
    context.addGlobal('group', async (name: string, fn: Function) => {
      console.log(`::group::${name}`);
      try {
        await fn();
      } finally {
        console.log('::endgroup::');
      }
    });
  },
  
  onBeforeExecute(command) {
    // Добавляем GitHub токен в окружение если доступен
    if (process.env.GITHUB_TOKEN && !command.env?.GITHUB_TOKEN) {
      command.env = {
        ...command.env,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN
      };
    }
    
    return command;
  }
};
```

## Часть 6: Тестирование и качество

### 6.1 Комплексный тестовый набор

```typescript
// packages/xs/tests/compatibility.test.ts

describe('zx API compatibility', () => {
  // Тест базового выполнения
  test('basic command execution', async () => {
    const result = await $`echo hello`;
    expect(result.stdout).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });
  
  // Тест интерполяции
  test('template literal interpolation', async () => {
    const name = 'world';
    const result = await $`echo hello ${name}`;
    expect(result.stdout).toBe('hello world\n');
  });
  
  // Тест pipe
  test('piping commands', async () => {
    const result = await $`echo "hello\nworld"`.pipe($`grep world`);
    expect(result.stdout).toBe('world\n');
  });
  
  // Тест обработки ошибок
  test('error handling', async () => {
    await expect($`exit 1`).rejects.toThrow();
    
    const result = await $`exit 1`.nothrow();
    expect(result.exitCode).toBe(1);
  });
  
  // Тест quiet режима
  test('quiet mode', async () => {
    const spy = jest.spyOn(console, 'log');
    await $`echo hello`.quiet();
    expect(spy).not.toHaveBeenCalled();
  });
  
  // Тест всех глобальных функций
  test('global functions availability', () => {
    expect(typeof cd).toBe('function');
    expect(typeof fetch).toBe('function');
    expect(typeof sleep).toBe('function');
    expect(typeof question).toBe('function');
    expect(typeof retry).toBe('function');
    expect(typeof spinner).toBe('function');
    expect(typeof glob).toBe('function');
    expect(typeof which).toBe('function');
  });
  
  // Тест синхронного API
  test('sync API', () => {
    const result = $.sync`echo hello`;
    expect(result.stdout).toBe('hello\n');
    expect(result.text).toBe('hello');
  });
});

// Тесты производительности
describe('performance benchmarks', () => {
  test('execution overhead', async () => {
    const iterations = 100;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await $`echo test`;
    }
    const xsTime = performance.now() - start;
    
    // Сравнение с прямым child_process
    const directStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await new Promise((resolve) => {
        exec('echo test', resolve);
      });
    }
    const directTime = performance.now() - directStart;
    
    // xs не должен быть медленнее чем на 20%
    expect(xsTime).toBeLessThan(directTime * 1.2);
  });
});
```

### 6.2 Интеграционные тесты

```typescript
// packages/xs/tests/integration.test.ts

describe('SSH integration', () => {
  const testServer = 'test.example.com';
  
  beforeAll(async () => {
    // Настройка тестового SSH сервера
    await setupTestSSHServer();
  });
  
  test('remote command execution', async () => {
    const $remote = $.ssh({
      host: testServer,
      username: 'test',
      privateKey: getTestKey()
    });
    
    const result = await $remote`uname -s`;
    expect(result.stdout).toMatch(/Linux|Darwin/);
  });
  
  test('file transfer', async () => {
    const $remote = $.ssh({ host: testServer });
    
    // Создаём локальный файл
    await $`echo "test content" > test.txt`;
    
    // Загружаем на сервер
    await $remote.upload('test.txt', '/tmp/test.txt');
    
    // Проверяем
    const result = await $remote`cat /tmp/test.txt`;
    expect(result.stdout).toBe('test content\n');
    
    // Очистка
    await $`rm test.txt`;
    await $remote`rm /tmp/test.txt`;
  });
});

describe('Docker integration', () => {
  test('container execution', async () => {
    const $docker = $.docker({
      container: 'test-container',
      image: 'alpine:latest'
    });
    
    // Автоматическое создание контейнера если не существует
    const result = await $docker`echo "Hello from container"`;
    expect(result.stdout).toBe('Hello from container\n');
    expect(result.container).toBe('test-container');
  });
  
  test('docker compose integration', async () => {
    // Создаём docker-compose.yml
    await fs.writeFile('docker-compose.yml', `
      version: '3'
      services:
        app:
          image: node:alpine
          command: tail -f /dev/null
    `);
    
    const $compose = $.compose();
    
    // Запуск
    await $compose`up -d`;
    
    // Выполнение в сервисе
    const result = await $compose.service('app')`node --version`;
    expect(result.stdout).toMatch(/^v\d+/);
    
    // Очистка
    await $compose`down`;
    await $`rm docker-compose.yml`;
  });
});
```

## Часть 7: Документация и примеры

### 7.1 Структура документации

```markdown
# packages/xs/docs/README.md

# xs - Enhanced Script Execution

xs is a tool for writing better scripts, fully compatible with Google's zx but with extended capabilities.

## Quick Start

```bash
npm install -g xs
```

```javascript
#!/usr/bin/env xs

await $`echo "Hello from xs!"`

// All zx features work
const branch = await $`git branch --show-current`
await $`deploy --branch=${branch}`

// Plus extended features
const servers = ['web1', 'web2', 'web3']
await $.parallel(servers, async (server) => {
  const $remote = $.ssh({ host: server })
  await $remote`docker pull myapp:latest`
  await $remote`docker restart myapp`
})
```

## Table of Contents

1. [Installation](./installation.md)
2. [Basic Usage](./basic-usage.md)
3. [API Reference](./api-reference.md)
4. [SSH Execution](./ssh.md)
5. [Docker Integration](./docker.md)
6. [Plugins](./plugins.md)
7. [Migration from zx](./migration.md)
8. [Examples](./examples/)
```

### 7.2 Примеры использования

```javascript
// examples/deployment.mjs
#!/usr/bin/env xs

// Полный пример деплоя приложения

import { group } from '@xs/github-actions';

const servers = {
  production: ['prod1.example.com', 'prod2.example.com'],
  staging: ['staging.example.com']
};

const environment = process.env.DEPLOY_ENV || 'staging';

await group(`Deploying to ${environment}`, async () => {
  // Сборка приложения
  await spinner('Building application', async () => {
    await $`npm run build`;
    await $`docker build -t myapp:${gitHash} .`;
  });
  
  // Загрузка в registry
  await retry(3, '5s', async () => {
    await $`docker push myapp:${gitHash}`;
  });
  
  // Деплой на серверы
  const results = await $.parallel(servers[environment], async (server) => {
    const $remote = $.ssh({ 
      host: server,
      username: 'deploy'
    });
    
    try {
      // Проверка здоровья
      await $remote`docker ps`;
      
      // Обновление
      await $remote`docker pull myapp:${gitHash}`;
      await $remote`docker stop myapp || true`;
      await $remote`docker run -d --name myapp --rm myapp:${gitHash}`;
      
      // Проверка
      await retry(5, '2s', async () => {
        const health = await $remote`curl -f http://localhost:3000/health`;
        if (!health.stdout.includes('ok')) {
          throw new Error('Health check failed');
        }
      });
      
      return { server, status: 'success' };
    } catch (error) {
      // Откат
      await $remote`docker stop myapp || true`;
      await $remote`docker run -d --name myapp --rm myapp:stable`;
      
      return { server, status: 'failed', error: error.message };
    }
  });
  
  // Отчёт
  console.log(chalk.bold('\nDeployment Summary:'));
  for (const result of results) {
    if (result.status === 'success') {
      console.log(chalk.green(`✓ ${result.server}`));
    } else {
      console.log(chalk.red(`✗ ${result.server}: ${result.error}`));
    }
  }
});
```

## Заключение

Это техническое задание описывает полный путь трансформации uxec в xs. Ключевые моменты для реализации:

1. **Поэтапная разработка** - начните с базовой совместимости, затем добавляйте расширенные функции
2. **Тщательное тестирование** - каждая функция должна иметь тесты
3. **Обратная совместимость** - существующие zx скрипты должны работать без изменений
4. **Документация** - документируйте отличия и новые возможности
5. **Производительность** - следите за overhead, xs должен быть не медленнее zx

Особое внимание уделите:
- Правильной обработке потоков в ProcessPromise
- Корректной работе с процессами (особенно завершение дочерних процессов)
- Безопасности при выполнении удалённых скриптов
- Кроссплатформенной совместимости

Проект xs станет мощным инструментом для DevOps и автоматизации, объединяя простоту zx с возможностями enterprise-уровня.