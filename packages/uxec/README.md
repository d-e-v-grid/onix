# @onix-js/unified-exec

Unified Execution Engine - 548=K9 8=B5@D59A 4;O 2K?>;=5=8O :><0=4 2 ;N1>< :>=B5:AB5 (;>:0;L=>, G5@57 SSH, 2 Docker :>=B59=5@0E).

## A>15==>AB8

- =€ **48=K9 API** - >48= 8=B5@D59A 4;O 2A5E B8?>2 2K?>;=5=8O
- =Ý **Template Literals** - A8=B0:A8A 2 AB8;5 zx A 02B><0B8G5A:8< M:@0=8@>20=85<
- = **>4C;L=0O 0@E8B5:BC@0** - 040?B5@K 4;O local, SSH, Docker
- >ê **Mock 040?B5@** - 2AB@>5==0O ?>445@6:0 B5AB8@>20=8O
- ¡ **>445@6:0 Bun** - 02B><0B8G5A:>5 >?@545;5=85 8 8A?>;L7>20=85 Bun.spawn
- = **C; A>548=5=89** - MDD5:B82=>5 ?5@58A?>;L7>20=85 SSH A>548=5=89
- =Ê **>B>:>20O >1@01>B:0** - @01>B0 A 1>;LH8<8 >1J5<0<8 40==KE
- =á **57>?0A=>ABL** - 02B><0B8G5A:>5 M:@0=8@>20=85 8 A0=8B870F8O

## #AB0=>2:0

```bash
npm install @onix-js/unified-exec
```

## KAB@K9 AB0@B

```typescript
import { $ } from '@onix-js/unified-exec';

// @>AB>5 2K?>;=5=85 :><0=4K
const result = await $`echo "Hello, World!"`;
console.log(result.stdout); // "Hello, World!"

// =B5@?>;OF8O A 02B><0B8G5A:8< M:@0=8@>20=85<
const filename = "my file.txt";
await $`touch ${filename}`;

// &5?>G:0 :>=D83C@0F88
const $prod = $.env({ NODE_ENV: 'production' }).cd('/app');
await $prod.run`npm start`;

// SSH 2K?>;=5=85
const $remote = $.ssh({
  host: 'server.example.com',
  username: 'deploy'
});
await $remote.run`docker restart myapp`;

// Docker 2K?>;=5=85
const $docker = $.docker({
  container: 'webapp',
  workdir: '/app'
});
await $docker.run`npm run migrate`;
```

## API

### !>740=85 4286:0

```typescript
import { createExecutionEngine } from '@onix-js/unified-exec';

const $ = createExecutionEngine({
  defaultTimeout: 60000,
  defaultCwd: '/app',
  defaultEnv: { NODE_ENV: 'production' },
  throwOnNonZeroExit: true,
  adapters: {
    ssh: {
      connectionPool: { enabled: true }
    }
  }
});
```

### 5B>4K :>=D83C@0F88

- `$.with(config)` - A>740BL =>2K9 4286>: A 4>?>;=8B5;L=>9 :>=D83C@0F859
- `$.cd(dir)` - 87<5=8BL @01>GCN 48@5:B>@8N
- `$.env(vars)` - 4>1028BL ?5@5<5==K5 >:@C65=8O
- `$.timeout(ms)` - CAB0=>28BL B09<0CB
- `$.shell(shell)` - C:070BL shell 4;O 2K?>;=5=8O

### 40?B5@K

- `$.local()` - ;>:0;L=>5 2K?>;=5=85 (?> C<>;G0=8N)
- `$.ssh(options)` - 2K?>;=5=85 G5@57 SSH
- `$.docker(options)` - 2K?>;=5=85 2 Docker :>=B59=5@5

### 1@01>B:0 >H81>:

```typescript
try {
  await $`exit 1`;
} catch (error) {
  if (error instanceof CommandError) {
    console.log('Exit code:', error.exitCode);
    console.log('Stderr:', error.stderr);
  }
}

// ;8 157 2K1@>A0 8A:;NG5=89
const $noThrow = $.with({ throwOnNonZeroExit: false });
const result = await $noThrow.run`exit 1`;
console.log(result.exitCode); // 1
```

## "5AB8@>20=85

A?>;L7C9B5 MockAdapter 4;O B5AB8@>20=8O:

```typescript
import { createExecutionEngine, MockAdapter } from '@onix-js/unified-exec';

const $ = createExecutionEngine();
const mock = new MockAdapter();
$.registerAdapter('mock', mock);

// 0AB@>9:0 <>:>2
mock.mockSuccess('git pull', 'Already up to date.');
mock.mockFailure('npm test', 'Tests failed!', 1);

// A?>;L7>20=85
const $mock = $.with({ adapter: 'mock' });
const result = await $mock.run`git pull`;

// @>25@:8
mock.assertCommandExecuted('git pull');
console.log(mock.getExecutedCommands());
```

## 8F5=78O

MIT