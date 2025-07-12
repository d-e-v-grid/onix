# Спецификация тестирования Unified Execution Engine

## Философия тестирования

Представьте, что мы строим надежный мост. Мы не можем просто проверить, что он красиво выглядит - нужно убедиться, что каждая балка выдержит нагрузку, каждое соединение прочное, и вся конструкция работает как единое целое. Точно так же с нашей библиотекой - мы должны проверить каждый компонент отдельно, их взаимодействие, и поведение системы в реальных условиях.

Наш подход к тестированию основан на принципе "тестовой пирамиды", где основание составляют многочисленные быстрые unit-тесты, середину - integration тесты, а вершину - небольшое количество end-to-end тестов. Это обеспечивает баланс между скоростью выполнения тестов и уверенностью в работоспособности системы.

## Структура тестов

Организация тестов отражает структуру самой библиотеки, что делает навигацию интуитивной:

```
tests/
├── unit/                              # Изолированные тесты компонентов
│   ├── core/
│   │   ├── execution-engine.test.ts
│   │   ├── command.test.ts
│   │   ├── result.test.ts
│   │   └── stream-handler.test.ts
│   ├── adapters/
│   │   ├── base-adapter.test.ts
│   │   ├── local-adapter.test.ts
│   │   ├── ssh-adapter.test.ts
│   │   └── docker-adapter.test.ts
│   └── utils/
│       ├── shell-escape.test.ts
│       ├── runtime-detect.test.ts
│       └── process-utils.test.ts
├── integration/                       # Тесты взаимодействия компонентов
│   ├── adapters/
│   │   ├── local-integration.test.ts
│   │   ├── ssh-integration.test.ts
│   │   └── docker-integration.test.ts
│   ├── error-handling.test.ts
│   ├── streaming.test.ts
│   └── cancellation.test.ts
├── e2e/                              # Сценарии из реальной жизни
│   ├── deployment-scenario.test.ts
│   ├── ci-pipeline.test.ts
│   └── multi-environment.test.ts
├── performance/                       # Тесты производительности
│   ├── connection-pooling.test.ts
│   ├── large-output.test.ts
│   └── parallel-execution.test.ts
├── security/                         # Тесты безопасности
│   ├── command-injection.test.ts
│   ├── path-traversal.test.ts
│   └── credential-leakage.test.ts
├── fixtures/                         # Тестовые данные
│   ├── scripts/
│   ├── docker/
│   └── ssh/
└── helpers/                          # Вспомогательные функции
    ├── test-environment.ts
    ├── mock-factories.ts
    └── assertions.ts
```

## Unit тесты - фундамент надежности

Unit тесты проверяют каждый компонент в изоляции, используя моки для всех внешних зависимостей. Это позволяет быстро находить проблемы и гарантирует, что каждая часть системы работает правильно сама по себе.

### Тестирование ExecutionEngine

ExecutionEngine - это сердце нашей библиотеки, поэтому его тестирование особенно важно:

```typescript
// tests/unit/core/execution-engine.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionEngine } from '../../../src/core/execution-engine';
import { LocalAdapter } from '../../../src/adapters/local-adapter';
import { SSHAdapter } from '../../../src/adapters/ssh-adapter';
import { DockerAdapter } from '../../../src/adapters/docker-adapter';
import { Command } from '../../../src/core/command';
import { ExecutionResult } from '../../../src/core/result';

// Мокаем все адаптеры чтобы изолировать тестирование ExecutionEngine
jest.mock('../../../src/adapters/local-adapter');
jest.mock('../../../src/adapters/ssh-adapter');
jest.mock('../../../src/adapters/docker-adapter');

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;
  let mockLocalAdapter: jest.Mocked<LocalAdapter>;
  let mockSSHAdapter: jest.Mocked<SSHAdapter>;
  let mockDockerAdapter: jest.Mocked<DockerAdapter>;
  
  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();
    
    // Создаем новый экземпляр движка с дефолтной конфигурацией
    engine = new ExecutionEngine({
      defaultTimeout: 5000,
      throwOnNonZeroExit: true
    });
    
    // Получаем ссылки на замоканные адаптеры
    mockLocalAdapter = (LocalAdapter as jest.MockedClass<typeof LocalAdapter>).mock.instances[0];
    mockSSHAdapter = (SSHAdapter as jest.MockedClass<typeof SSHAdapter>).mock.instances[0];
    mockDockerAdapter = (DockerAdapter as jest.MockedClass<typeof DockerAdapter>).mock.instances[0];
  });
  
  describe('Инициализация и конфигурация', () => {
    it('должен создаваться с дефолтными настройками', () => {
      const engine = new ExecutionEngine();
      expect(engine.config).toEqual({
        defaultTimeout: 30000,
        throwOnNonZeroExit: false,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
    });
    
    it('должен принимать пользовательскую конфигурацию', () => {
      const customConfig = {
        defaultTimeout: 60000,
        defaultCwd: '/home/user',
        defaultEnv: { NODE_ENV: 'test' },
        adapters: {
          ssh: { connectionPool: { enabled: true } }
        }
      };
      
      const engine = new ExecutionEngine(customConfig);
      expect(engine.config).toMatchObject(customConfig);
    });
    
    it('должен валидировать конфигурацию', () => {
      // Негативные значения таймаута недопустимы
      expect(() => new ExecutionEngine({ defaultTimeout: -1000 }))
        .toThrow('Invalid timeout value: -1000');
      
      // Неподдерживаемая кодировка
      expect(() => new ExecutionEngine({ encoding: 'invalid' as any }))
        .toThrow('Unsupported encoding: invalid');
    });
  });
  
  describe('Выбор адаптера', () => {
    it('должен использовать LocalAdapter по умолчанию', async () => {
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: 'test output',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      await engine.execute({ command: 'echo test' });
      
      expect(mockLocalAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'echo test' })
      );
    });
    
    it('должен выбирать адаптер на основе команды', async () => {
      mockSSHAdapter.execute.mockResolvedValue({
        stdout: 'remote output',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      await engine.execute({
        command: 'ls -la',
        adapter: 'ssh',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      expect(mockSSHAdapter.execute).toHaveBeenCalled();
      expect(mockLocalAdapter.execute).not.toHaveBeenCalled();
    });
    
    it('должен автоматически определять адаптер по контексту', async () => {
      // Если движок был создан с SSH контекстом
      const sshEngine = engine.ssh({ host: 'server.com', username: 'deploy' });
      
      mockSSHAdapter.execute.mockResolvedValue({
        stdout: 'remote output',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      await sshEngine.execute({ command: 'pwd' });
      
      expect(mockSSHAdapter.execute).toHaveBeenCalled();
    });
  });
  
  describe('Template literal API', () => {
    it('должен правильно парсить простые команды', async () => {
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: 'Hello, World!',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      const result = await engine.tag`echo "Hello, World!"`;
      
      expect(mockLocalAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'echo "Hello, World!"',
          args: undefined
        })
      );
      expect(result.stdout).toBe('Hello, World!');
    });
    
    it('должен правильно интерполировать и экранировать значения', async () => {
      const filename = 'my file with spaces.txt';
      const content = 'Hello; rm -rf /';
      
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      await engine.tag`echo ${content} > ${filename}`;
      
      // Проверяем что опасные символы были экранированы
      expect(mockLocalAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'echo \'Hello; rm -rf /\' > \'my file with spaces.txt\''
        })
      );
    });
    
    it('должен поддерживать массивы в интерполяции', async () => {
      const files = ['file1.txt', 'file2.txt', 'file with spaces.txt'];
      
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      } as ExecutionResult);
      
      await engine.tag`rm ${files}`;
      
      expect(mockLocalAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'rm file1.txt file2.txt \'file with spaces.txt\''
        })
      );
    });
  });
  
  describe('Обработка ошибок', () => {
    it('должен бросать ошибку при ненулевом exit code если throwOnNonZeroExit = true', async () => {
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        command: 'nonexistent-command'
      } as ExecutionResult);
      
      await expect(engine.execute({ command: 'nonexistent-command' }))
        .rejects.toThrow('Command failed with exit code 127');
    });
    
    it('не должен бросать ошибку при ненулевом exit code если throwOnNonZeroExit = false', async () => {
      const nonThrowingEngine = new ExecutionEngine({ throwOnNonZeroExit: false });
      
      mockLocalAdapter.execute.mockResolvedValue({
        stdout: '',
        stderr: 'Permission denied',
        exitCode: 1
      } as ExecutionResult);
      
      const result = await nonThrowingEngine.execute({ command: 'cat /etc/shadow' });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('Permission denied');
    });
    
    it('должен обрабатывать таймауты', async () => {
      mockLocalAdapter.execute.mockRejectedValue(
        new TimeoutError('sleep 10', 5000)
      );
      
      await expect(engine.execute({ 
        command: 'sleep 10',
        timeout: 5000 
      })).rejects.toThrow('Command timed out after 5000ms');
    });
  });
  
  describe('Цепочка конфигурации', () => {
    it('должен создавать новый экземпляр с измененной конфигурацией через with()', () => {
      const newEngine = engine.with({
        env: { NODE_ENV: 'production' },
        cwd: '/app'
      });
      
      // Проверяем что это новый экземпляр
      expect(newEngine).not.toBe(engine);
      
      // Проверяем что конфигурация объединена правильно
      expect(newEngine.config.defaultEnv).toEqual({ NODE_ENV: 'production' });
      expect(newEngine.config.defaultCwd).toBe('/app');
      
      // Оригинальный движок не изменился
      expect(engine.config.defaultEnv).toBeUndefined();
    });
    
    it('должен поддерживать множественные цепочки', () => {
      const prod = engine
        .with({ env: { NODE_ENV: 'production' } })
        .with({ cwd: '/app' })
        .with({ timeout: 60000 });
      
      expect(prod.config).toMatchObject({
        defaultEnv: { NODE_ENV: 'production' },
        defaultCwd: '/app',
        defaultTimeout: 60000
      });
    });
  });
});
```

### Тестирование адаптеров

Каждый адаптер требует специфического подхода к тестированию. Рассмотрим LocalAdapter как пример:

```typescript
// tests/unit/adapters/local-adapter.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LocalAdapter } from '../../../src/adapters/local-adapter';
import { RuntimeDetector } from '../../../src/utils/runtime-detect';
import * as child_process from 'child_process';
import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';

// Мокаем модули
jest.mock('child_process');
jest.mock('../../../src/utils/runtime-detect');

describe('LocalAdapter', () => {
  let adapter: LocalAdapter;
  let mockSpawn: jest.MockedFunction<typeof child_process.spawn>;
  let mockExec: jest.MockedFunction<typeof child_process.exec>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new LocalAdapter({});
    mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
    mockExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;
    
    // По умолчанию определяем runtime как Node.js
    (RuntimeDetector.detect as jest.Mock).mockReturnValue('node');
  });
  
  describe('Выполнение команд', () => {
    it('должен выполнять простые команды', async () => {
      // Создаем мок процесса
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new Readable({
        read() {
          this.push('Hello, World!\n');
          this.push(null); // EOF
        }
      });
      mockProcess.stderr = new Readable({ read() { this.push(null); } });
      mockProcess.stdin = new Writable({ write() {} });
      mockProcess.pid = 12345;
      
      mockSpawn.mockReturnValue(mockProcess);
      
      // Запускаем выполнение
      const resultPromise = adapter.execute({ 
        command: 'echo',
        args: ['Hello, World!']
      });
      
      // Эмулируем завершение процесса
      setImmediate(() => {
        mockProcess.emit('exit', 0, null);
        mockProcess.emit('close', 0, null);
      });
      
      const result = await resultPromise;
      
      expect(result.stdout).toBe('Hello, World!\n');
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['Hello, World!'], expect.any(Object));
    });
    
    it('должен правильно обрабатывать shell режим', async () => {
      const mockProcess = createMockProcess('file1.txt file2.txt', '', 0);
      mockSpawn.mockReturnValue(mockProcess);
      
      await adapter.execute({
        command: 'ls *.txt | grep file',
        shell: true
      });
      
      // В shell режиме команда передается как единая строка
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringMatching(/sh|cmd/), // Зависит от платформы
        expect.arrayContaining(['-c', 'ls *.txt | grep file']),
        expect.any(Object)
      );
    });
    
    it('должен передавать переменные окружения', async () => {
      const mockProcess = createMockProcess('production', '', 0);
      mockSpawn.mockReturnValue(mockProcess);
      
      await adapter.execute({
        command: 'echo',
        args: ['$NODE_ENV'],
        env: { NODE_ENV: 'production' },
        shell: true
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ NODE_ENV: 'production' })
        })
      );
    });
    
    it('должен устанавливать рабочую директорию', async () => {
      const mockProcess = createMockProcess('/home/user/project', '', 0);
      mockSpawn.mockReturnValue(mockProcess);
      
      await adapter.execute({
        command: 'pwd',
        cwd: '/home/user/project'
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'pwd',
        [],
        expect.objectContaining({ cwd: '/home/user/project' })
      );
    });
  });
  
  describe('Обработка потоков', () => {
    it('должен правильно обрабатывать stdin', async () => {
      const mockProcess = createMockProcess('HELLO', '', 0);
      const stdinData: string[] = [];
      
      // Перехватываем данные записанные в stdin
      mockProcess.stdin.write = jest.fn((chunk) => {
        stdinData.push(chunk.toString());
        return true;
      });
      
      mockSpawn.mockReturnValue(mockProcess);
      
      await adapter.execute({
        command: 'tr',
        args: ['[a-z]', '[A-Z]'],
        stdin: 'hello'
      });
      
      expect(stdinData.join('')).toBe('hello');
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });
    
    it('должен поддерживать потоковый stdin', async () => {
      const mockProcess = createMockProcess('3', '', 0);
      const inputStream = new Readable({
        read() {
          this.push('line1\n');
          this.push('line2\n');
          this.push('line3\n');
          this.push(null);
        }
      });
      
      mockSpawn.mockReturnValue(mockProcess);
      
      await adapter.execute({
        command: 'wc',
        args: ['-l'],
        stdin: inputStream
      });
      
      expect(mockSpawn).toHaveBeenCalled();
      // Проверяем что поток был подключен к процессу
      expect(inputStream.pipe).toHaveBeenCalled();
    });
    
    it('должен обрабатывать большие выводы без переполнения буфера', async () => {
      // Создаем процесс с большим выводом
      const largeOutput = 'x'.repeat(1024 * 1024); // 1MB
      const mockProcess = new EventEmitter() as any;
      let position = 0;
      
      mockProcess.stdout = new Readable({
        read(size) {
          if (position >= largeOutput.length) {
            this.push(null);
            return;
          }
          const chunk = largeOutput.slice(position, position + size);
          position += size;
          this.push(chunk);
        }
      });
      mockProcess.stderr = new Readable({ read() { this.push(null); } });
      mockProcess.stdin = new Writable({ write() {} });
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const resultPromise = adapter.execute({
        command: 'generate-large-output',
        maxBuffer: 2 * 1024 * 1024 // 2MB
      });
      
      setImmediate(() => {
        mockProcess.emit('exit', 0, null);
        mockProcess.emit('close', 0, null);
      });
      
      const result = await resultPromise;
      expect(result.stdout.length).toBe(largeOutput.length);
    });
  });
  
  describe('Обработка ошибок', () => {
    it('должен правильно обрабатывать ненулевые коды выхода', async () => {
      const mockProcess = createMockProcess('', 'No such file', 1);
      mockSpawn.mockReturnValue(mockProcess);
      
      const result = await adapter.execute({
        command: 'cat',
        args: ['nonexistent.txt']
      });
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('No such file');
    });
    
    it('должен обрабатывать сигналы завершения', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });
      mockProcess.stdin = new Writable({ write() {} });
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const resultPromise = adapter.execute({
        command: 'long-running-process'
      });
      
      // Эмулируем завершение по сигналу
      setImmediate(() => {
        mockProcess.emit('exit', null, 'SIGTERM');
        mockProcess.emit('close', null, 'SIGTERM');
      });
      
      const result = await resultPromise;
      expect(result.signal).toBe('SIGTERM');
      expect(result.exitCode).toBe(null);
    });
    
    it('должен обрабатывать ошибки spawn', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn ENOENT');
      });
      
      await expect(adapter.execute({ command: 'nonexistent-command' }))
        .rejects.toThrow('Failed to spawn process: spawn ENOENT');
    });
  });
  
  describe('Таймауты', () => {
    it('должен прерывать процесс по таймауту', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });
      mockProcess.stdin = new Writable({ write() {} });
      mockProcess.pid = 12345;
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const resultPromise = adapter.execute({
        command: 'sleep',
        args: ['10'],
        timeout: 100 // 100ms
      });
      
      // Ждем чуть больше таймаута
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Проверяем что процесс был убит
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Эмулируем завершение после kill
      mockProcess.emit('exit', null, 'SIGTERM');
      mockProcess.emit('close', null, 'SIGTERM');
      
      await expect(resultPromise).rejects.toThrow('Command timed out after 100ms');
    });
    
    it('должен использовать правильную последовательность сигналов при таймауте', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });
      mockProcess.stdin = new Writable({ write() {} });
      mockProcess.kill = jest.fn(() => true);
      
      mockSpawn.mockReturnValue(mockProcess);
      
      // Запускаем с коротким таймаутом
      const resultPromise = adapter.execute({
        command: 'stubborn-process',
        timeout: 50,
        killSignal: 'SIGINT' // Сначала попробуем SIGINT
      });
      
      // Ждем первый сигнал
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGINT');
      
      // Процесс игнорирует SIGINT, ждем grace period
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      // Должен быть послан SIGKILL
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      
      mockProcess.emit('exit', null, 'SIGKILL');
      mockProcess.emit('close', null, 'SIGKILL');
      
      await expect(resultPromise).rejects.toThrow('Command timed out');
    });
  });
  
  describe('Отмена выполнения через AbortSignal', () => {
    it('должен поддерживать отмену через AbortController', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });
      mockProcess.stdin = new Writable({ write() {} });
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const controller = new AbortController();
      
      const resultPromise = adapter.execute({
        command: 'long-task',
        signal: controller.signal
      });
      
      // Отменяем через 100ms
      setTimeout(() => controller.abort(), 100);
      
      await expect(resultPromise).rejects.toThrow('Command was aborted');
      expect(mockProcess.kill).toHaveBeenCalled();
    });
    
    it('не должен запускать процесс если сигнал уже отменен', async () => {
      const controller = new AbortController();
      controller.abort(); // Отменяем сразу
      
      await expect(adapter.execute({
        command: 'echo',
        args: ['test'],
        signal: controller.signal
      })).rejects.toThrow('Command was aborted');
      
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
  
  describe('Runtime специфичное поведение', () => {
    it('должен использовать Bun.spawn когда доступен', async () => {
      // Настраиваем мок для Bun runtime
      (RuntimeDetector.detect as jest.Mock).mockReturnValue('bun');
      
      // Создаем мок Bun API
      const mockBunSpawn = jest.fn().mockReturnValue({
        stdout: {
          [Symbol.asyncIterator]: async function* () {
            yield new TextEncoder().encode('Bun output');
          }
        },
        stderr: {
          [Symbol.asyncIterator]: async function* () {}
        },
        stdin: { write: jest.fn(), end: jest.fn() },
        exited: Promise.resolve(0)
      });
      
      global.Bun = { spawn: mockBunSpawn } as any;
      
      // Создаем адаптер с preference для Bun
      const bunAdapter = new LocalAdapter({ preferBun: true });
      
      const result = await bunAdapter.execute({
        command: 'echo',
        args: ['Hello from Bun']
      });
      
      expect(mockBunSpawn).toHaveBeenCalledWith({
        cmd: ['echo', 'Hello from Bun'],
        cwd: undefined,
        env: process.env,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe'
      });
      
      expect(result.stdout).toContain('Bun output');
      
      // Очищаем глобальный Bun
      delete global.Bun;
    });
    
    it('должен fallback на Node.js если Bun недоступен', async () => {
      (RuntimeDetector.detect as jest.Mock).mockReturnValue('node');
      
      const adapter = new LocalAdapter({ preferBun: true });
      const mockProcess = createMockProcess('Node output', '', 0);
      mockSpawn.mockReturnValue(mockProcess);
      
      const result = await adapter.execute({
        command: 'echo',
        args: ['Hello from Node']
      });
      
      expect(mockSpawn).toHaveBeenCalled();
      expect(result.stdout).toBe('Node output');
    });
  });
});

// Вспомогательная функция для создания мок процесса
function createMockProcess(stdout: string, stderr: string, exitCode: number): any {
  const process = new EventEmitter() as any;
  
  process.stdout = new Readable({
    read() {
      this.push(stdout);
      this.push(null);
    }
  });
  
  process.stderr = new Readable({
    read() {
      this.push(stderr);
      this.push(null);
    }
  });
  
  process.stdin = new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });
  process.stdin.end = jest.fn();
  
  process.kill = jest.fn();
  process.pid = Math.floor(Math.random() * 10000);
  
  // Автоматически эмитим события завершения
  setImmediate(() => {
    process.emit('exit', exitCode, null);
    process.emit('close', exitCode, null);
  });
  
  return process;
}
```

### Тестирование SSHAdapter

SSH адаптер требует особого внимания к мокированию SSH соединений:

```typescript
// tests/unit/adapters/ssh-adapter.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SSHAdapter } from '../../../src/adapters/ssh-adapter';
import { NodeSSH } from 'node-ssh';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

jest.mock('node-ssh');

describe('SSHAdapter', () => {
  let adapter: SSHAdapter;
  let mockSSHClient: jest.Mocked<NodeSSH>;
  let mockSSHPool: Map<string, jest.Mocked<NodeSSH>>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSSHPool = new Map();
    
    // Настраиваем мок конструктора NodeSSH
    (NodeSSH as jest.MockedClass<typeof NodeSSH>).mockImplementation(() => {
      mockSSHClient = {
        isConnected: jest.fn().mockReturnValue(false),
        connect: jest.fn().mockResolvedValue(undefined),
        execCommand: jest.fn(),
        exec: jest.fn(),
        dispose: jest.fn(),
        putFile: jest.fn(),
        getFile: jest.fn(),
        putDirectory: jest.fn(),
        getDirectory: jest.fn()
      } as any;
      
      return mockSSHClient;
    });
    
    adapter = new SSHAdapter({
      connectionPool: {
        enabled: true,
        maxConnections: 5,
        idleTimeout: 60000,
        keepAlive: true
      }
    });
  });
  
  describe('Управление соединениями', () => {
    it('должен устанавливать SSH соединение', async () => {
      mockSSHClient.execCommand.mockResolvedValue({
        stdout: 'test output',
        stderr: '',
        code: 0,
        signal: undefined
      });
      
      const result = await adapter.execute({
        command: 'echo test',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user',
          privateKey: 'mock-key'
        }
      });
      
      expect(mockSSHClient.connect).toHaveBeenCalledWith({
        host: 'example.com',
        username: 'user',
        privateKey: 'mock-key'
      });
      
      expect(result.stdout).toBe('test output');
      expect(result.host).toBe('example.com');
    });
    
    it('должен переиспользовать соединения из пула', async () => {
      const options = {
        type: 'ssh' as const,
        host: 'example.com',
        username: 'user'
      };
      
      mockSSHClient.isConnected.mockReturnValue(true);
      mockSSHClient.execCommand.mockResolvedValue({
        stdout: 'output',
        stderr: '',
        code: 0
      });
      
      // Первое выполнение - устанавливает соединение
      await adapter.execute({ command: 'echo 1', adapterOptions: options });
      expect(mockSSHClient.connect).toHaveBeenCalledTimes(1);
      
      // Второе выполнение - должно использовать существующее соединение
      await adapter.execute({ command: 'echo 2', adapterOptions: options });
      expect(mockSSHClient.connect).toHaveBeenCalledTimes(1);
      expect(mockSSHClient.execCommand).toHaveBeenCalledTimes(2);
    });
    
    it('должен ограничивать количество соединений в пуле', async () => {
      // Создаем больше соединений чем разрешено
      const connections = [];
      for (let i = 0; i < 7; i++) {
        connections.push(adapter.execute({
          command: 'echo test',
          adapterOptions: {
            type: 'ssh',
            host: `server${i}.com`,
            username: 'user'
          }
        }));
      }
      
      // Ждем все соединения
      await Promise.all(connections);
      
      // Проверяем что создано не больше максимального количества
      const activeConnections = (adapter as any).connectionPool.size;
      expect(activeConnections).toBeLessThanOrEqual(5);
    });
    
    it('должен закрывать неактивные соединения', async () => {
      jest.useFakeTimers();
      
      mockSSHClient.isConnected.mockReturnValue(true);
      mockSSHClient.execCommand.mockResolvedValue({
        stdout: 'output',
        stderr: '',
        code: 0
      });
      
      // Выполняем команду
      await adapter.execute({
        command: 'echo test',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      // Проверяем что соединение активно
      expect(mockSSHClient.dispose).not.toHaveBeenCalled();
      
      // Продвигаем время на больше чем idleTimeout
      jest.advanceTimersByTime(65000);
      
      // Проверяем что соединение закрыто
      expect(mockSSHClient.dispose).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
  
  describe('Выполнение команд', () => {
    beforeEach(() => {
      mockSSHClient.isConnected.mockReturnValue(true);
    });
    
    it('должен выполнять команды с правильными опциями', async () => {
      mockSSHClient.execCommand.mockResolvedValue({
        stdout: 'current directory',
        stderr: '',
        code: 0
      });
      
      await adapter.execute({
        command: 'pwd',
        cwd: '/home/user',
        env: { CUSTOM_VAR: 'value' },
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      expect(mockSSHClient.execCommand).toHaveBeenCalledWith('pwd', {
        cwd: '/home/user',
        env: { CUSTOM_VAR: 'value' }
      });
    });
    
    it('должен поддерживать потоковый вывод', async () => {
      // Создаем мок потокового выполнения
      const mockChannel = new EventEmitter() as any;
      mockChannel.stdout = new EventEmitter() as any;
      mockChannel.stderr = new EventEmitter() as any;
      mockChannel.stdin = new Writable({
        write(chunk, encoding, callback) {
          callback?.();
        }
      });
      mockChannel.stdin.end = jest.fn();
      
      mockSSHClient.exec.mockImplementation((command, args, options) => {
        const callback = options.onChannel;
        if (callback) {
          callback(mockChannel);
        }
        
        // Эмулируем потоковый вывод
        setTimeout(() => {
          mockChannel.stdout.emit('data', Buffer.from('Line 1\n'));
          mockChannel.stdout.emit('data', Buffer.from('Line 2\n'));
          mockChannel.emit('close', { exitCode: 0, signalCode: undefined });
        }, 10);
        
        return Promise.resolve();
      });
      
      const output: string[] = [];
      const result = await adapter.execute({
        command: 'tail -f /var/log/app.log',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        },
        onStdout: (chunk) => {
          output.push(chunk.toString());
        }
      });
      
      expect(output).toEqual(['Line 1\n', 'Line 2\n']);
    });
    
    it('должен обрабатывать stdin', async () => {
      let receivedStdin = '';
      
      mockSSHClient.execCommand.mockImplementation(async (command, options) => {
        receivedStdin = options?.stdin || '';
        return {
          stdout: receivedStdin.toUpperCase(),
          stderr: '',
          code: 0
        };
      });
      
      const result = await adapter.execute({
        command: 'tr [a-z] [A-Z]',
        stdin: 'hello world',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      expect(result.stdout).toBe('HELLO WORLD');
    });
  });
  
  describe('Sudo поддержка', () => {
    it('должен выполнять команды с sudo когда настроено', async () => {
      const sudoAdapter = new SSHAdapter({
        sudo: {
          enabled: true,
          password: 'secret'
        }
      });
      
      mockSSHClient.isConnected.mockReturnValue(true);
      mockSSHClient.execCommand.mockResolvedValue({
        stdout: 'root',
        stderr: '',
        code: 0
      });
      
      await sudoAdapter.execute({
        command: 'whoami',
        sudo: true,
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      // Проверяем что команда была обернута в sudo
      expect(mockSSHClient.execCommand).toHaveBeenCalledWith(
        expect.stringContaining('sudo'),
        expect.any(Object)
      );
    });
    
    it('должен правильно передавать пароль для sudo', async () => {
      const sudoAdapter = new SSHAdapter({
        sudo: {
          enabled: true,
          password: 'secret',
          prompt: '[sudo] password'
        }
      });
      
      // Мокаем интерактивное выполнение sudo
      const mockChannel = new EventEmitter() as any;
      mockChannel.stdout = new EventEmitter() as any;
      mockChannel.stderr = new EventEmitter() as any;
      mockChannel.stdin = {
        write: jest.fn(),
        end: jest.fn()
      };
      
      mockSSHClient.exec.mockImplementation((command, args, options) => {
        const callback = options.onChannel;
        if (callback) {
          callback(mockChannel);
        }
        
        // Эмулируем запрос пароля sudo
        setTimeout(() => {
          mockChannel.stdout.emit('data', Buffer.from('[sudo] password for user: '));
          
          // Проверяем что пароль был отправлен
          setTimeout(() => {
            expect(mockChannel.stdin.write).toHaveBeenCalledWith('secret\n');
            mockChannel.stdout.emit('data', Buffer.from('\nroot\n'));
            mockChannel.emit('close', { exitCode: 0 });
          }, 10);
        }, 10);
        
        return Promise.resolve();
      });
      
      mockSSHClient.isConnected.mockReturnValue(true);
      
      const result = await sudoAdapter.execute({
        command: 'whoami',
        sudo: true,
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      expect(result.stdout).toContain('root');
    });
  });
  
  describe('SFTP операции', () => {
    it('должен поддерживать загрузку файлов', async () => {
      const sftpAdapter = new SSHAdapter({
        sftp: { enabled: true, concurrency: 3 }
      });
      
      mockSSHClient.isConnected.mockReturnValue(true);
      mockSSHClient.putFile.mockResolvedValue(undefined);
      
      await sftpAdapter.uploadFile(
        '/local/file.txt',
        '/remote/file.txt',
        {
          host: 'example.com',
          username: 'user'
        }
      );
      
      expect(mockSSHClient.putFile).toHaveBeenCalledWith(
        '/local/file.txt',
        '/remote/file.txt'
      );
    });
    
    it('должен поддерживать загрузку директорий', async () => {
      const sftpAdapter = new SSHAdapter({
        sftp: { enabled: true, concurrency: 3 }
      });
      
      mockSSHClient.isConnected.mockReturnValue(true);
      mockSSHClient.putDirectory.mockResolvedValue(true);
      
      await sftpAdapter.uploadDirectory(
        '/local/dir',
        '/remote/dir',
        {
          host: 'example.com',
          username: 'user'
        },
        {
          recursive: true,
          concurrency: 3,
          validate: (itemPath) => !itemPath.includes('node_modules')
        }
      );
      
      expect(mockSSHClient.putDirectory).toHaveBeenCalledWith(
        '/local/dir',
        '/remote/dir',
        expect.objectContaining({
          recursive: true,
          concurrency: 3,
          validate: expect.any(Function)
        })
      );
    });
  });
  
  describe('Мультиплексирование SSH', () => {
    it('должен использовать ControlMaster когда включено', async () => {
      const multiplexAdapter = new SSHAdapter({
        multiplexing: {
          enabled: true,
          controlPath: '/tmp/ssh-%r@%h:%p',
          controlPersist: '10m'
        }
      });
      
      // Для мультиплексирования адаптер может использовать нативный ssh клиент
      // вместо node-ssh для установки master соединения
      const mockExec = jest.spyOn(require('child_process'), 'exec');
      
      await multiplexAdapter.execute({
        command: 'echo test',
        adapterOptions: {
          type: 'ssh',
          host: 'example.com',
          username: 'user'
        }
      });
      
      // Проверяем что были использованы правильные SSH опции
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('-o ControlMaster=auto'),
        expect.any(Function)
      );
      
      mockExec.mockRestore();
    });
  });
});
```

### Тестирование утилит

Утилиты требуют тщательного тестирования edge cases:

```typescript
// tests/unit/utils/shell-escape.test.ts
import { describe, it, expect } from '@jest/globals';
import { shellEscape, shellQuote, parseCommand } from '../../../src/utils/shell-escape';

describe('shellEscape', () => {
  describe('Базовое экранирование', () => {
    it('должен оставлять простые строки без изменений', () => {
      expect(shellEscape('hello')).toBe('hello');
      expect(shellEscape('test123')).toBe('test123');
      expect(shellEscape('under_score')).toBe('under_score');
      expect(shellEscape('dash-separated')).toBe('dash-separated');
    });
    
    it('должен экранировать пробелы', () => {
      expect(shellEscape('hello world')).toBe("'hello world'");
      expect(shellEscape('multiple  spaces')).toBe("'multiple  spaces'");
    });
    
    it('должен экранировать специальные символы shell', () => {
      expect(shellEscape('$variable')).toBe("'$variable'");
      expect(shellEscape('command; rm -rf /')).toBe("'command; rm -rf /'");
      expect(shellEscape('pipe | grep')).toBe("'pipe | grep'");
      expect(shellEscape('redirect > file')).toBe("'redirect > file'");
      expect(shellEscape('background &')).toBe("'background &'");
    });
    
    it('должен правильно обрабатывать одинарные кавычки', () => {
      expect(shellEscape("it's")).toBe("'it'\"'\"'s'");
      expect(shellEscape("don't")).toBe("'don'\"'\"'t'");
      expect(shellEscape("'quoted'")).toBe("''\"'\"'quoted'\"'\"''");
    });
    
    it('должен обрабатывать переводы строк и табуляции', () => {
      expect(shellEscape('line1\nline2')).toBe("'line1\nline2'");
      expect(shellEscape('tab\there')).toBe("'tab\there'");
    });
    
    it('должен обрабатывать пустые строки', () => {
      expect(shellEscape('')).toBe("''");
    });
    
    it('должен обрабатывать null и undefined', () => {
      expect(shellEscape(null as any)).toBe("''");
      expect(shellEscape(undefined as any)).toBe("''");
    });
  });
  
  describe('Экранирование для разных платформ', () => {
    it('должен использовать правильное экранирование для Windows', () => {
      const windowsEscape = shellEscape('hello world', { platform: 'win32' });
      expect(windowsEscape).toBe('"hello world"');
      
      const cmdSpecial = shellEscape('echo & dir', { platform: 'win32' });
      expect(cmdSpecial).toBe('"echo & dir"');
    });
    
    it('должен экранировать обратные слеши в Windows', () => {
      const path = shellEscape('C:\\Program Files\\App', { platform: 'win32' });
      expect(path).toBe('"C:\\Program Files\\App"');
    });
    
    it('должен обрабатывать переменные окружения Windows', () => {
      const envVar = shellEscape('%PATH%', { platform: 'win32' });
      expect(envVar).toBe('"%PATH%"');
    });
  });
  
  describe('Массивы аргументов', () => {
    it('должен правильно экранировать массивы', () => {
      const args = ['file1.txt', 'file with spaces.txt', "file's.txt"];
      const escaped = shellEscape(args);
      expect(escaped).toBe("file1.txt 'file with spaces.txt' 'file'\"'\"'s.txt'");
    });
    
    it('должен обрабатывать пустые массивы', () => {
      expect(shellEscape([])).toBe('');
    });
    
    it('должен фильтровать null и undefined в массивах', () => {
      const args = ['arg1', null, 'arg2', undefined, 'arg3'];
      const escaped = shellEscape(args as any);
      expect(escaped).toBe('arg1 arg2 arg3');
    });
  });
});

describe('shellQuote', () => {
  it('должен правильно парсить простые команды', () => {
    expect(shellQuote.parse('echo hello world')).toEqual(['echo', 'hello', 'world']);
    expect(shellQuote.parse('ls -la')).toEqual(['ls', '-la']);
  });
  
  it('должен обрабатывать кавычки', () => {
    expect(shellQuote.parse('echo "hello world"')).toEqual(['echo', 'hello world']);
    expect(shellQuote.parse("echo 'single quotes'")).toEqual(['echo', 'single quotes']);
    expect(shellQuote.parse('echo "mixed \'quotes\'"')).toEqual(['echo', "mixed 'quotes'"]);
  });
  
  it('должен обрабатывать экранированные символы', () => {
    expect(shellQuote.parse('echo escaped\\ space')).toEqual(['echo', 'escaped space']);
    expect(shellQuote.parse('echo escaped\\$var')).toEqual(['echo', 'escaped$var']);
  });
  
  it('должен распознавать операторы', () => {
    const parsed = shellQuote.parse('echo hello && echo world');
    expect(parsed).toEqual([
      'echo', 'hello',
      { op: '&&' },
      'echo', 'world'
    ]);
  });
  
  it('должен обрабатывать переменные окружения', () => {
    const parsed = shellQuote.parse('echo $HOME', {
      HOME: '/home/user'
    });
    expect(parsed).toEqual(['echo', '/home/user']);
  });
  
  it('должен обрабатывать подстановку команд', () => {
    const parsed = shellQuote.parse('echo $(date)');
    expect(parsed).toContainEqual(expect.objectContaining({ op: 'glob' }));
  });
});

describe('parseCommand', () => {
  it('должен разделять команду на исполняемый файл и аргументы', () => {
    const { command, args } = parseCommand('git commit -m "Initial commit"');
    expect(command).toBe('git');
    expect(args).toEqual(['commit', '-m', 'Initial commit']);
  });
  
  it('должен обрабатывать команды с путями', () => {
    const { command, args } = parseCommand('/usr/bin/node script.js --flag');
    expect(command).toBe('/usr/bin/node');
    expect(args).toEqual(['script.js', '--flag']);
  });
  
  it('должен обрабатывать пустые команды', () => {
    const { command, args } = parseCommand('');
    expect(command).toBe('');
    expect(args).toEqual([]);
  });
  
  it('должен обрабатывать команды только с исполняемым файлом', () => {
    const { command, args } = parseCommand('ls');
    expect(command).toBe('ls');
    expect(args).toEqual([]);
  });
});
```

## Integration тесты - проверка взаимодействия

Integration тесты проверяют, как компоненты работают вместе, используя реальные реализации где возможно:

```typescript
// tests/integration/local-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ExecutionEngine } from '../../src/core/execution-engine';
import { LocalAdapter } from '../../src/adapters/local-adapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('LocalAdapter Integration', () => {
  let engine: ExecutionEngine;
  let testDir: string;
  
  beforeAll(async () => {
    // Создаем временную директорию для тестов
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exec-engine-test-'));
    
    engine = new ExecutionEngine({
      defaultCwd: testDir,
      adapters: {
        local: {
          // Используем реальную реализацию
        }
      }
    });
  });
  
  afterAll(async () => {
    // Очищаем временную директорию
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('Реальное выполнение команд', () => {
    it('должен выполнять простые команды', async () => {
      const result = await engine.tag`echo "Hello, Integration Tests!"`;
      expect(result.stdout.trim()).toBe('Hello, Integration Tests!');
      expect(result.exitCode).toBe(0);
    });
    
    it('должен правильно работать с файловой системой', async () => {
      const filename = 'test-file.txt';
      const content = 'Integration test content';
      
      // Создаем файл
      await engine.tag`echo ${content} > ${filename}`;
      
      // Проверяем что файл создан
      const exists = await fs.access(path.join(testDir, filename))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
      
      // Читаем содержимое
      const readResult = await engine.tag`cat ${filename}`;
      expect(readResult.stdout.trim()).toBe(content);
      
      // Удаляем файл
      await engine.tag`rm ${filename}`;
      
      // Проверяем что файл удален
      const existsAfter = await fs.access(path.join(testDir, filename))
        .then(() => true)
        .catch(() => false);
      expect(existsAfter).toBe(false);
    });
    
    it('должен правильно обрабатывать пайпы', async () => {
      // Создаем несколько файлов
      await engine.tag`echo "apple" > fruits1.txt`;
      await engine.tag`echo "banana" > fruits2.txt`;
      await engine.tag`echo "cherry" > fruits3.txt`;
      
      // Используем пайп для подсчета
      const result = await engine.tag`cat fruits*.txt | wc -l`;
      expect(parseInt(result.stdout.trim())).toBe(3);
      
      // Сортировка через пайп
      const sortResult = await engine.tag`cat fruits*.txt | sort`;
      const lines = sortResult.stdout.trim().split('\n');
      expect(lines).toEqual(['apple', 'banana', 'cherry']);
    });
    
    it('должен правильно передавать переменные окружения', async () => {
      const result = await engine
        .with({ env: { CUSTOM_VAR: 'test-value' } })
        .tag`echo $CUSTOM_VAR`;
      
      expect(result.stdout.trim()).toBe('test-value');
    });
    
    it('должен обрабатывать большие выводы', async () => {
      // Генерируем большой вывод
      const lines = 10000;
      const result = await engine.tag`seq 1 ${lines}`;
      
      const outputLines = result.stdout.trim().split('\n');
      expect(outputLines).toHaveLength(lines);
      expect(outputLines[0]).toBe('1');
      expect(outputLines[outputLines.length - 1]).toBe(lines.toString());
    });
  });
  
  describe('Обработка ошибок в реальных условиях', () => {
    it('должен правильно обрабатывать несуществующие команды', async () => {
      await expect(engine.tag`nonexistentcommand123`)
        .rejects.toThrow(/command not found|not recognized/i);
    });
    
    it('должен обрабатывать команды с ненулевым кодом выхода', async () => {
      const nonThrowingEngine = engine.with({ throwOnNonZeroExit: false });
      const result = await nonThrowingEngine.tag`ls /nonexistent/path`;
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/no such file or directory/i);
    });
    
    it('должен правильно обрабатывать прерывание по таймауту', async () => {
      await expect(
        engine.with({ timeout: 100 }).tag`sleep 2`
      ).rejects.toThrow('Command timed out after 100ms');
    });
  });
  
  describe('Параллельное выполнение', () => {
    it('должен корректно выполнять команды параллельно', async () => {
      const start = Date.now();
      
      // Выполняем несколько команд параллельно
      const results = await Promise.all([
        engine.tag`sleep 0.1 && echo "Task 1"`,
        engine.tag`sleep 0.1 && echo "Task 2"`,
        engine.tag`sleep 0.1 && echo "Task 3"`,
      ]);
      
      const duration = Date.now() - start;
      
      // Проверяем что команды выполнились параллельно (не последовательно)
      expect(duration).toBeLessThan(300); // Должно быть около 100ms, а не 300ms
      
      // Проверяем результаты
      expect(results[0].stdout.trim()).toBe('Task 1');
      expect(results[1].stdout.trim()).toBe('Task 2');
      expect(results[2].stdout.trim()).toBe('Task 3');
    });
  });
  
  describe('Интерактивные команды', () => {
    it('должен поддерживать stdin для интерактивных команд', async () => {
      // Используем команду которая читает stdin
      const result = await engine.execute({
        command: 'cat',
        stdin: 'Hello from stdin\nLine 2\n'
      });
      
      expect(result.stdout).toBe('Hello from stdin\nLine 2\n');
    });
    
    it('должен поддерживать потоковый stdin', async () => {
      const { Readable } = await import('stream');
      
      // Создаем поток данных
      const inputStream = new Readable({
        read() {
          this.push('Stream line 1\n');
          this.push('Stream line 2\n');
          this.push(null); // EOF
        }
      });
      
      const result = await engine.execute({
        command: 'cat',
        stdin: inputStream
      });
      
      expect(result.stdout).toBe('Stream line 1\nStream line 2\n');
    });
  });
});
```

### SSH Integration тесты

Для SSH тестов нужен либо реальный SSH сервер, либо контейнер:

```typescript
// tests/integration/ssh-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ExecutionEngine } from '../../src/core/execution-engine';
import { DockerTestEnvironment } from '../helpers/docker-test-env';
import * as path from 'path';

describe('SSHAdapter Integration', () => {
  let engine: ExecutionEngine;
  let testEnv: DockerTestEnvironment;
  let sshConfig: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
  };
  
  beforeAll(async () => {
    // Запускаем SSH сервер в Docker контейнере
    testEnv = new DockerTestEnvironment();
    await testEnv.start();
    
    sshConfig = await testEnv.getSSHConfig();
    
    engine = new ExecutionEngine({
      adapters: {
        ssh: {
          connectionPool: {
            enabled: true,
            maxConnections: 3
          }
        }
      }
    });
  }, 30000); // Увеличенный таймаут для запуска контейнера
  
  afterAll(async () => {
    await testEnv.stop();
  });
  
  describe('SSH выполнение команд', () => {
    it('должен подключаться и выполнять команды', async () => {
      const $remote = engine.ssh(sshConfig);
      
      const result = await $remote`whoami`;
      expect(result.stdout.trim()).toBe(sshConfig.username);
    });
    
    it('должен работать с файлами на удаленном сервере', async () => {
      const $remote = engine.ssh(sshConfig);
      
      // Создаем файл
      await $remote`echo "SSH test content" > /tmp/ssh-test.txt`;
      
      // Читаем файл
      const content = await $remote`cat /tmp/ssh-test.txt`;
      expect(content.stdout.trim()).toBe('SSH test content');
      
      // Удаляем файл
      await $remote`rm /tmp/ssh-test.txt`;
      
      // Проверяем что файл удален
      const checkResult = await $remote
        .with({ throwOnNonZeroExit: false })
        .tag`ls /tmp/ssh-test.txt`;
      expect(checkResult.exitCode).not.toBe(0);
    });
    
    it('должен правильно передавать переменные окружения', async () => {
      const $remote = engine.ssh(sshConfig);
      
      const result = await $remote
        .with({ env: { REMOTE_VAR: 'remote-value' } })
        .tag`echo $REMOTE_VAR`;
      
      expect(result.stdout.trim()).toBe('remote-value');
    });
    
    it('должен поддерживать выполнение в разных директориях', async () => {
      const $remote = engine.ssh(sshConfig);
      
      // Создаем тестовую директорию
      await $remote`mkdir -p /tmp/test-dir`;
      
      // Выполняем команду в этой директории
      const result = await $remote
        .with({ cwd: '/tmp/test-dir' })
        .tag`pwd`;
      
      expect(result.stdout.trim()).toBe('/tmp/test-dir');
      
      // Очищаем
      await $remote`rm -rf /tmp/test-dir`;
    });
  });
  
  describe('SSH пул соединений', () => {
    it('должен переиспользовать соединения', async () => {
      const $remote = engine.ssh(sshConfig);
      
      const start = Date.now();
      
      // Выполняем несколько команд последовательно
      for (let i = 0; i < 5; i++) {
        await $remote`echo "Command ${i}"`;
      }
      
      const duration = Date.now() - start;
      
      // Если бы каждая команда устанавливала новое соединение,
      // это заняло бы намного больше времени
      expect(duration).toBeLessThan(1000);
    });
    
    it('должен корректно работать с параллельными запросами', async () => {
      const $remote = engine.ssh(sshConfig);
      
      // Выполняем команды параллельно
      const results = await Promise.all([
        $remote`echo "Parallel 1"`,
        $remote`echo "Parallel 2"`,
        $remote`echo "Parallel 3"`,
        $remote`echo "Parallel 4"`,
        $remote`echo "Parallel 5"`,
      ]);
      
      // Проверяем что все команды выполнились успешно
      results.forEach((result, index) => {
        expect(result.stdout.trim()).toBe(`Parallel ${index + 1}`);
      });
    });
  });
  
  describe('SFTP операции', () => {
    it('должен загружать файлы на сервер', async () => {
      const $remote = engine.ssh(sshConfig);
      const localFile = path.join(__dirname, '../fixtures/test-file.txt');
      const remoteFile = '/tmp/uploaded-file.txt';
      
      // Загружаем файл
      await $remote.uploadFile(localFile, remoteFile);
      
      // Проверяем что файл существует
      const checkResult = await $remote`ls -la ${remoteFile}`;
      expect(checkResult.exitCode).toBe(0);
      
      // Проверяем содержимое
      const content = await $remote`cat ${remoteFile}`;
      expect(content.stdout).toContain('test content');
      
      // Очищаем
      await $remote`rm ${remoteFile}`;
    });
    
    it('должен скачивать файлы с сервера', async () => {
      const $remote = engine.ssh(sshConfig);
      const remoteFile = '/tmp/download-test.txt';
      const localFile = path.join(__dirname, 'downloaded.txt');
      
      // Создаем файл на сервере
      await $remote`echo "Download test content" > ${remoteFile}`;
      
      // Скачиваем файл
      await $remote.downloadFile(remoteFile, localFile);
      
      // Проверяем локальный файл
      const fs = await import('fs/promises');
      const content = await fs.readFile(localFile, 'utf-8');
      expect(content).toContain('Download test content');
      
      // Очищаем
      await $remote`rm ${remoteFile}`;
      await fs.unlink(localFile);
    });
  });
  
  describe('Обработка ошибок SSH', () => {
    it('должен правильно обрабатывать ошибки подключения', async () => {
      const $invalid = engine.ssh({
        host: 'nonexistent.host',
        username: 'user',
        privateKey: 'invalid-key'
      });
      
      await expect($invalid`echo test`)
        .rejects.toThrow(/Failed to connect|getaddrinfo/);
    });
    
    it('должен обрабатывать разрыв соединения', async () => {
      const $remote = engine.ssh(sshConfig);
      
      // Выполняем команду чтобы установить соединение
      await $remote`echo "Connected"`;
      
      // Останавливаем SSH сервер
      await testEnv.stopSSH();
      
      // Пытаемся выполнить команду
      await expect($remote`echo "After disconnect"`)
        .rejects.toThrow(/Connection lost|ECONNRESET/);
      
      // Восстанавливаем SSH сервер для других тестов
      await testEnv.startSSH();
    });
  });
});
```

## End-to-End тесты - реальные сценарии

E2E тесты проверяют полные сценарии использования:

```typescript
// tests/e2e/deployment-scenario.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ExecutionEngine } from '../../src';
import { TestInfrastructure } from '../helpers/test-infrastructure';

describe('E2E: Deployment Scenario', () => {
  let engine: ExecutionEngine;
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // Создаем тестовую инфраструктуру с несколькими серверами
    infra = new TestInfrastructure();
    await infra.setup({
      servers: ['web1', 'web2', 'db1'],
      network: 'test-deployment'
    });
    
    engine = new ExecutionEngine({
      defaultTimeout: 60000,
      adapters: {
        ssh: {
          connectionPool: { enabled: true }
        }
      }
    });
  }, 60000);
  
  afterAll(async () => {
    await infra.teardown();
  });
  
  it('должен выполнять полный сценарий развертывания приложения', async () => {
    // Получаем конфигурации серверов
    const servers = await infra.getServers();
    
    // Шаг 1: Подготовка серверов
    console.log('Preparing servers...');
    
    for (const server of servers.filter(s => s.name.startsWith('web'))) {
      const $server = engine.ssh(server.sshConfig);
      
      // Обновляем пакеты
      await $server`apt-get update -qq`;
      
      // Устанавливаем Node.js
      await $server`curl -fsSL https://deb.nodesource.com/setup_18.x | bash -`;
      await $server`apt-get install -y nodejs`;
      
      // Проверяем установку
      const nodeVersion = await $server`node --version`;
      expect(nodeVersion.stdout).toMatch(/v18\.\d+\.\d+/);
    }
    
    // Шаг 2: Развертывание базы данных
    console.log('Setting up database...');
    
    const $db = engine.ssh(servers.find(s => s.name === 'db1')!.sshConfig);
    
    // Устанавливаем PostgreSQL
    await $db`apt-get install -y postgresql postgresql-contrib`;
    
    // Создаем базу данных
    await $db`sudo -u postgres psql -c "CREATE DATABASE appdb;"`;
    await $db`sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'secure_password';"`;
    await $db`sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE appdb TO appuser;"`;
    
    // Шаг 3: Развертывание приложения
    console.log('Deploying application...');
    
    const deploymentTasks = servers
      .filter(s => s.name.startsWith('web'))
      .map(async (server) => {
        const $server = engine.ssh(server.sshConfig);
        
        // Создаем директорию приложения
        await $server`mkdir -p /opt/app`;
        await $server.with({ cwd: '/opt/app' }).tag`pwd`;
        
        // Копируем файлы приложения (симуляция)
        await $server`echo '{"name":"test-app","version":"1.0.0"}' > /opt/app/package.json`;
        await $server`echo 'console.log("Hello from app");' > /opt/app/index.js`;
        
        // Устанавливаем зависимости (если были бы)
        // await $server.with({ cwd: '/opt/app' }).tag`npm install`;
        
        // Создаем systemd сервис
        const serviceFile = `
[Unit]
Description=Test App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/app
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=DB_HOST=${servers.find(s => s.name === 'db1')!.ip}

[Install]
WantedBy=multi-user.target
`;
        
        await $server`echo ${serviceFile} > /etc/systemd/system/test-app.service`;
        await $server`systemctl daemon-reload`;
        await $server`systemctl enable test-app`;
        await $server`systemctl start test-app`;
        
        // Проверяем статус
        const status = await $server`systemctl is-active test-app`;
        expect(status.stdout.trim()).toBe('active');
      });
    
    await Promise.all(deploymentTasks);
    
    // Шаг 4: Настройка балансировщика нагрузки
    console.log('Setting up load balancer...');
    
    const $web1 = engine.ssh(servers.find(s => s.name === 'web1')!.sshConfig);
    
    // Устанавливаем nginx на первый веб-сервер
    await $web1`apt-get install -y nginx`;
    
    // Конфигурация балансировщика
    const nginxConfig = `
upstream app_backend {
    ${servers.filter(s => s.name.startsWith('web'))
      .map(s => `server ${s.ip}:3000;`)
      .join('\n    ')}
}

server {
    listen 80;
    location / {
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;
    
    await $web1`echo ${nginxConfig} > /etc/nginx/sites-available/default`;
    await $web1`systemctl restart nginx`;
    
    // Шаг 5: Проверка работоспособности
    console.log('Verifying deployment...');
    
    // Проверяем каждый сервер напрямую
    for (const server of servers.filter(s => s.name.startsWith('web'))) {
      const $server = engine.ssh(server.sshConfig);
      const logs = await $server`journalctl -u test-app -n 10`;
      expect(logs.stdout).toContain('Hello from app');
    }
    
    // Проверяем через балансировщик
    const $lb = engine.ssh(servers.find(s => s.name === 'web1')!.sshConfig);
    const response = await $lb`curl -s http://localhost/`;
    expect(response.exitCode).toBe(0);
    
    console.log('Deployment completed successfully!');
  }, 120000); // 2 минуты на весь тест
});
```

## Performance тесты

Тесты производительности проверяют, что библиотека работает эффективно:

```typescript
// tests/performance/connection-pooling.test.ts
import { describe, it, expect } from '@jest/globals';
import { ExecutionEngine } from '../../src';
import { performance } from 'perf_hooks';

describe('Performance: Connection Pooling', () => {
  it('должен значительно ускорять множественные SSH команды', async () => {
    const engine = new ExecutionEngine();
    const sshConfig = {
      host: process.env.TEST_SSH_HOST || 'localhost',
      username: process.env.TEST_SSH_USER || 'test',
      privateKey: process.env.TEST_SSH_KEY || ''
    };
    
    // Тест без пула соединений
    const engineNoPool = new ExecutionEngine({
      adapters: {
        ssh: { connectionPool: { enabled: false } }
      }
    });
    
    const commandCount = 10;
    const commands = Array(commandCount).fill('echo "test"');
    
    // Измеряем без пула
    const startNoPool = performance.now();
    for (const cmd of commands) {
      await engineNoPool.ssh(sshConfig).execute({ command: cmd });
    }
    const durationNoPool = performance.now() - startNoPool;
    
    // Измеряем с пулом
    const engineWithPool = new ExecutionEngine({
      adapters: {
        ssh: { connectionPool: { enabled: true } }
      }
    });
    
    const $remote = engineWithPool.ssh(sshConfig);
    const startWithPool = performance.now();
    for (const cmd of commands) {
      await $remote.execute({ command: cmd });
    }
    const durationWithPool = performance.now() - startWithPool;
    
    console.log(`Without pool: ${durationNoPool.toFixed(2)}ms`);
    console.log(`With pool: ${durationWithPool.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationNoPool / durationWithPool).toFixed(2)}x`);
    
    // Ожидаем минимум 2x ускорение
    expect(durationWithPool).toBeLessThan(durationNoPool / 2);
  });
  
  it('должен эффективно обрабатывать большое количество параллельных соединений', async () => {
    const engine = new ExecutionEngine({
      adapters: {
        ssh: {
          connectionPool: {
            enabled: true,
            maxConnections: 10
          }
        }
      }
    });
    
    // Создаем много "серверов" (в реальности это может быть один)
    const servers = Array(50).fill(null).map((_, i) => ({
      host: process.env.TEST_SSH_HOST || 'localhost',
      username: process.env.TEST_SSH_USER || 'test',
      privateKey: process.env.TEST_SSH_KEY || '',
      // Добавляем уникальный идентификатор для различения
      tag: `server-${i}`
    }));
    
    const start = performance.now();
    
    // Выполняем команды на всех "серверах" параллельно
    const results = await Promise.all(
      servers.map(config => 
        engine.ssh(config).tag`echo "Response from ${config.tag}"`
      )
    );
    
    const duration = performance.now() - start;
    
    // Проверяем что все команды выполнились
    expect(results).toHaveLength(50);
    results.forEach((result, i) => {
      expect(result.stdout).toContain(`Response from server-${i}`);
    });
    
    console.log(`Executed 50 commands in ${duration.toFixed(2)}ms`);
    console.log(`Average time per command: ${(duration / 50).toFixed(2)}ms`);
    
    // При пуле из 10 соединений, должно быть примерно 5 "волн" выполнения
    // Каждая волна не должна занимать больше секунды
    expect(duration).toBeLessThan(6000);
  });
});
```

## Security тесты

Проверка защиты от различных атак:

```typescript
// tests/security/command-injection.test.ts
import { describe, it, expect } from '@jest/globals';
import { ExecutionEngine } from '../../src';
import { shellEscape } from '../../src/utils/shell-escape';

describe('Security: Command Injection Prevention', () => {
  let engine: ExecutionEngine;
  
  beforeEach(() => {
    engine = new ExecutionEngine();
  });
  
  it('должен предотвращать базовую command injection', async () => {
    const maliciousInput = '; rm -rf /';
    
    // Используем template literal API - должно быть безопасно
    const result = await engine
      .with({ throwOnNonZeroExit: false })
      .tag`echo ${maliciousInput}`;
    
    // Команда должна просто вывести строку, а не выполнить rm
    expect(result.stdout.trim()).toBe('; rm -rf /');
    expect(result.exitCode).toBe(0);
  });
  
  it('должен безопасно обрабатывать различные попытки инъекции', async () => {
    const injectionAttempts = [
      '$(rm -rf /)',
      '`rm -rf /`',
      '| rm -rf /',
      '&& rm -rf /',
      '; rm -rf /',
      '\n rm -rf /',
      '"; rm -rf /"',
      "'; rm -rf /'",
      '${IFS}rm${IFS}-rf${IFS}/',
    ];
    
    for (const attempt of injectionAttempts) {
      const result = await engine
        .with({ throwOnNonZeroExit: false })
        .tag`echo ${attempt}`;
      
      // Все попытки должны быть выведены как текст
      expect(result.stdout.trim()).toBe(attempt);
      expect(result.stderr).toBe('');
    }
  });
  
  it('должен правильно экранировать специальные символы', () => {
    const testCases = [
      { input: '$HOME', expected: "'$HOME'" },
      { input: '$(date)', expected: "'$(date)'" },
      { input: '`whoami`', expected: "'`whoami`'" },
      { input: 'test\ncommand', expected: "'test\ncommand'" },
      { input: 'test\rcommand', expected: "'test\rcommand'" },
      { input: 'test\x00null', expected: "'test\x00null'" },
    ];
    
    testCases.forEach(({ input, expected }) => {
      expect(shellEscape(input)).toBe(expected);
    });
  });
  
  it('должен безопасно обрабатывать пути файлов', async () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file\x00.txt',
      'file\nname.txt',
      'file;rm -rf /',
      'file$(whoami).txt',
    ];
    
    for (const filename of maliciousFilenames) {
      // Попытка создать файл с опасным именем
      const result = await engine
        .with({ throwOnNonZeroExit: false })
        .tag`touch /tmp/${filename}`;
      
      // Команда может fail из-за невалидного имени файла,
      // но не должна выполнить инъекцию
      if (result.exitCode === 0) {
        // Если файл создался, проверим что он действительно имеет это имя
        const checkResult = await engine.tag`ls /tmp/ | grep -F ${filename}`;
        expect(checkResult.stdout).toContain(filename);
        
        // Очищаем
        await engine.tag`rm -f /tmp/${filename}`;
      }
    }
  });
  
  it('не должен логировать чувствительную информацию', async () => {
    const sensitiveData = {
      password: 'super-secret-password',
      apiKey: 'sk-1234567890abcdef',
      token: 'ghp_xxxxxxxxxxxxxxxxxxxx'
    };
    
    // Перехватываем console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Создаем engine с verbose логированием
    const verboseEngine = new ExecutionEngine({
      verbose: true,
      adapters: {
        local: { logCommands: true }
      }
    });
    
    // Выполняем команду с чувствительными данными
    await verboseEngine.execute({
      command: 'echo',
      args: [sensitiveData.password],
      env: {
        API_KEY: sensitiveData.apiKey,
        GITHUB_TOKEN: sensitiveData.token
      }
    });
    
    // Проверяем что логи не содержат чувствительных данных
    const allLogs = [
      ...consoleSpy.mock.calls,
      ...consoleErrorSpy.mock.calls
    ].flat().join(' ');
    
    expect(allLogs).not.toContain(sensitiveData.password);
    expect(allLogs).not.toContain(sensitiveData.apiKey);
    expect(allLogs).not.toContain(sensitiveData.token);
    
    // Восстанавливаем console
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
```

## Тестовые помощники

Для упрощения написания тестов создаем вспомогательные утилиты:

```typescript
// tests/helpers/test-environment.ts
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class DockerTestEnvironment {
  private container?: StartedTestContainer;
  private sshKeyPath?: string;
  
  async start(): Promise<void> {
    // Генерируем SSH ключи
    const keyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ssh-test-'));
    this.sshKeyPath = path.join(keyDir, 'id_rsa');
    
    // Создаем SSH ключи
    await this.generateSSHKeys(this.sshKeyPath);
    
    // Запускаем контейнер с SSH сервером
    this.container = await new GenericContainer('linuxserver/openssh-server')
      .withExposedPorts(2222)
      .withEnvironment({
        PUID: '1000',
        PGID: '1000',
        TZ: 'UTC',
        PUBLIC_KEY: await fs.readFile(`${this.sshKeyPath}.pub`, 'utf-8'),
        SUDO_ACCESS: 'true',
        USER_NAME: 'testuser'
      })
      .start();
    
    // Ждем готовности SSH
    await this.waitForSSH();
  }
  
  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
    }
    
    if (this.sshKeyPath) {
      await fs.rm(path.dirname(this.sshKeyPath), { recursive: true });
    }
  }
  
  async getSSHConfig() {
    if (!this.container || !this.sshKeyPath) {
      throw new Error('Test environment not started');
    }
    
    return {
      host: 'localhost',
      port: this.container.getMappedPort(2222),
      username: 'testuser',
      privateKey: await fs.readFile(this.sshKeyPath, 'utf-8')
    };
  }
  
  private async generateSSHKeys(keyPath: string): Promise<void> {
    const { execSync } = await import('child_process');
    execSync(`ssh-keygen -t rsa -b 2048 -f ${keyPath} -N "" -q`);
  }
  
  private async waitForSSH(maxAttempts = 30): Promise<void> {
    const config = await this.getSSHConfig();
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { NodeSSH } = await import('node-ssh');
        const ssh = new NodeSSH();
        await ssh.connect(config);
        await ssh.dispose();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('SSH server did not start in time');
  }
}

// tests/helpers/mock-factories.ts
export function createMockSSHClient(responses: Record<string, any> = {}) {
  return {
    isConnected: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    execCommand: jest.fn().mockImplementation((cmd) => {
      const response = responses[cmd] || {
        stdout: '',
        stderr: '',
        code: 0
      };
      return Promise.resolve(response);
    }),
    dispose: jest.fn()
  };
}

export function createMockProcess(config: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  signal?: string;
  delay?: number;
}) {
  const { EventEmitter } = require('events');
  const { Readable, Writable } = require('stream');
  
  const process = new EventEmitter();
  
  process.stdout = new Readable({
    read() {
      if (config.stdout) {
        this.push(config.stdout);
        this.push(null);
      }
    }
  });
  
  process.stderr = new Readable({
    read() {
      if (config.stderr) {
        this.push(config.stderr);
        this.push(null);
      }
    }
  });
  
  process.stdin = new Writable({
    write(chunk: any, encoding: any, callback: any) {
      callback();
    }
  });
  
  process.kill = jest.fn();
  process.pid = Math.floor(Math.random() * 10000);
  
  // Эмулируем завершение процесса
  setTimeout(() => {
    process.emit('exit', config.exitCode || 0, config.signal || null);
    process.emit('close', config.exitCode || 0, config.signal || null);
  }, config.delay || 0);
  
  return process;
}

// tests/helpers/assertions.ts
export function expectCommand(result: any) {
  return {
    toSucceed() {
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    },
    
    toFail(expectedCode?: number) {
      expect(result.exitCode).not.toBe(0);
      if (expectedCode !== undefined) {
        expect(result.exitCode).toBe(expectedCode);
      }
    },
    
    toOutput(expected: string | RegExp) {
      if (typeof expected === 'string') {
        expect(result.stdout).toContain(expected);
      } else {
        expect(result.stdout).toMatch(expected);
      }
    },
    
    toError(expected: string | RegExp) {
      if (typeof expected === 'string') {
        expect(result.stderr).toContain(expected);
      } else {
        expect(result.stderr).toMatch(expected);
      }
    }
  };
}
```

## Конфигурация Jest

Настройка Jest для оптимального тестирования:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Паттерны тестовых файлов
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  
  // Покрытие кода
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Настройки TypeScript
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },
  
  // Моки
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Setup файлы
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Таймауты
  testTimeout: 30000,
  
  // Параллельность
  maxWorkers: '50%',
  
  // Отчеты
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }]
  ]
};

// tests/setup.ts
import { config } from 'dotenv';

// Загружаем тестовые переменные окружения
config({ path: '.env.test' });

// Глобальные моки
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn()
}));

// Увеличиваем таймаут для интеграционных тестов
if (process.env.TEST_TYPE === 'integration') {
  jest.setTimeout(60000);
}

// Глобальные утилиты для тестов
global.testHelpers = {
  async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  randomString(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
  }
};
```

## Заключение

Эта спецификация обеспечивает полное покрытие кода тестами на всех уровнях. Unit тесты проверяют каждый компонент в изоляции, integration тесты убеждаются в корректном взаимодействии частей системы, а E2E тесты валидируют реальные сценарии использования. Security и performance тесты гарантируют, что библиотека не только работает правильно, но и безопасно и эффективно.

Ключевые принципы тестирования:
- Каждый публичный метод должен иметь тесты
- Edge cases важнее happy path
- Моки должны быть реалистичными
- Интеграционные тесты должны использовать реальные компоненты где возможно
- Тесты должны быть независимыми и воспроизводимыми

Следуя этой спецификации, вы получите надежную и хорошо протестированную библиотеку, готовую к production использованию.