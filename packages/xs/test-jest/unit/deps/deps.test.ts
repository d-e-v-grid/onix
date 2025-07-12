import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'node:path';
import { $, fs, tmpfile } from '../../../src/index';
import { parseDeps, installDeps } from '../../../src/deps';

const root = path.resolve(process.cwd());
const cli = path.resolve(root, 'build/cli.js');

describe('Dependencies management', () => {
  describe('parseDeps()', () => {
    it('should parse import statements', () => {
      expect(parseDeps(`import "foo"`)).toEqual({ foo: 'latest' });
      expect(parseDeps(`import * as bar from "foo"`)).toEqual({ foo: 'latest' });
      expect(parseDeps(`import('foo')`)).toEqual({ foo: 'latest' });
    });

    it('should parse require statements', () => {
      expect(parseDeps(`require('foo')`)).toEqual({ foo: 'latest' });
      expect(parseDeps(`require('foo/bar')`)).toEqual({ foo: 'latest' });
      expect(parseDeps(`require('foo/bar.js')`)).toEqual({ foo: 'latest' });
    });

    it('should handle package names with special characters', () => {
      expect(parseDeps(`require('foo-bar')`)).toEqual({ 'foo-bar': 'latest' });
      expect(parseDeps(`require('foo_bar')`)).toEqual({ foo_bar: 'latest' });
      expect(parseDeps(`require('foo.js')`)).toEqual({ 'foo.js': 'latest' });
    });

    it('should handle scoped packages', () => {
      expect(parseDeps(`require('@foo/bar')`)).toEqual({ '@foo/bar': 'latest' });
      expect(parseDeps(`require('@foo/bar/baz')`)).toEqual({ '@foo/bar': 'latest' });
      expect(parseDeps(`import "@foo/bar/file"`)).toEqual({ '@foo/bar': 'latest' });
    });

    it('should ignore local dependencies', () => {
      expect(parseDeps(`import '.'`)).toEqual({});
      expect(parseDeps(`require('.')`)).toEqual({});
      expect(parseDeps(`require('..')`)).toEqual({});
      expect(parseDeps(`require('../foo.js')`)).toEqual({});
      expect(parseDeps(`require('./foo.js')`)).toEqual({});
    });

    it('should ignore invalid package names', () => {
      expect(parseDeps(`require('_foo')`)).toEqual({});
      expect(parseDeps(`require('@')`)).toEqual({});
      expect(parseDeps(`require('@/_foo')`)).toEqual({});
      expect(parseDeps(`require('@foo')`)).toEqual({});
    });

    it('should parse versions from comments', () => {
      expect(parseDeps(`import "foo" // @2.x`)).toEqual({ foo: '2.x' });
      expect(parseDeps(`import "foo" // @^7`)).toEqual({ foo: '^7' });
      expect(parseDeps(`import "foo" /* @1.2.x */`)).toEqual({ foo: '1.2.x' });
    });

    it('should parse complex multiline code', () => {
      const contents = `
  require('a') // @1.0.0
  const b =require('b') /* @2.0.0 */
  const c = {
    c:require('c') /* @3.0.0 */,
    d: await import('d') /* @4.0.0 */,
    ...require('e') /* @5.0.0 */
  }
  const f = [...require('f') /* @6.0.0 */]
  ;require('g'); // @7.0.0
  const h = 1 *require('h') // @8.0.0
  {require('i') /* @9.0.0 */}
  import 'j' // @10.0.0

  import fs from 'fs'
  import path from 'path'
  import foo from "foo"
  // import aaa from 'a'
  /* import bbb from 'b' */
  import bar from "bar" /* @1.0.0 */
  import baz from "baz" //    @^2.0
  import qux from "@qux/pkg/entry" //    @^3.0
  import {api as alias} from "qux/entry/index.js" // @^4.0.0-beta.0

  const cpy = await import('cpy')
  const { pick } = require("lodash") //  @4.17.15
  `;

      expect(parseDeps(contents)).toEqual({
        a: '1.0.0',
        b: '2.0.0',
        c: '3.0.0',
        d: '4.0.0',
        e: '5.0.0',
        f: '6.0.0',
        g: '7.0.0',
        h: '8.0.0',
        i: '9.0.0',
        j: '10.0.0',
        foo: 'latest',
        bar: '1.0.0',
        baz: '^2.0',
        '@qux/pkg': '^3.0',
        qux: '^4.0.0-beta.0',
        cpy: 'latest',
        lodash: '4.17.15',
      });
    });

    it('should ignore commented out imports', () => {
      const contents = `
        // import foo from 'foo'
        /* import bar from 'bar' */
        import baz from 'baz'
      `;
      
      expect(parseDeps(contents)).toEqual({ baz: 'latest' });
    });

    it('should handle various import styles', () => {
      const testCases: Array<[string, Record<string, string>]> = [
        [`import "foo"`, { foo: 'latest' }],
        [`import * as bar from "foo"`, { foo: 'latest' }],
        [`import { something } from "foo"`, { foo: 'latest' }],
        [`import foo, { bar } from "foo"`, { foo: 'latest' }],
        [`import type { Type } from "foo"`, { foo: 'latest' }],
        [`const mod = require('foo')`, { foo: 'latest' }],
        [`require.resolve('foo')`, { foo: 'latest' }],
      ];

      testCases.forEach(([input, expected]) => {
        expect(parseDeps(input)).toEqual(expected);
      });
    });
  });

  describe('installDeps()', () => {
    let pkgjson: string;
    let cwd: string;
    let t$: any;
    let load: (dep: string) => any;

    beforeAll(() => {
      pkgjson = tmpfile(
        'package.json',
        '{"name": "temp", "version": "0.0.0"}'
      );
      cwd = path.dirname(pkgjson);
      t$ = $({ cwd });
      load = (dep: string) =>
        fs.readJsonSync(path.join(cwd, 'node_modules', dep, 'package.json'));
    });

    afterAll(async () => {
      await fs.remove(cwd);
    });

    it('should install dependencies via JS API', async () => {
      await installDeps(
        {
          cpy: '9.0.1',
          'lodash-es': '4.17.21',
        },
        cwd
      );
      
      expect(load('cpy').name).toBe('cpy');
      expect(load('lodash-es').name).toBe('lodash-es');
    });

    it('should install dependencies with custom npm registry URL', async () => {
      await installDeps(
        {
          '@jsr/std__internal': '1.0.5',
        },
        cwd,
        'https://npm.jsr.io'
      );

      expect(load('@jsr/std__internal').name).toBe('@jsr/std__internal');
    });

    it('should work via CLI', async () => {
      const result = await t$`node ${cli} --install <<< 'import _ from "lodash" /* @4.17.15 */; console.log(_.VERSION)'`;
      
      expect(result.stdout).toContain('4.17.15');
    });

    it('should work via CLI with custom npm registry URL', async () => {
      const code = 'import { diff } from "@jsr/std__internal";console.log(diff instanceof Function)';
      const file = tmpfile('index.mjs', code);

      const result1 = await t$`node ${cli} --i --registry=https://npm.jsr.io ${file}`;
      fs.remove(file);
      expect(result1.stdout).toContain('true');

      const result2 = await t$`node ${cli} -i --registry=https://npm.jsr.io <<< ${code}`;
      expect(result2.stdout).toContain('true');
    });

    it('should throw on invalid installer type', async () => {
      await expect(
        installDeps({ foo: 'latest' }, cwd, 'https://npm.jsr.io', 'invalid' as any)
      ).rejects.toThrow(/Unsupported installer type: invalid. Supported types: npm/);
    });

    it('should handle empty dependencies', async () => {
      await expect(installDeps({}, cwd)).resolves.not.toThrow();
    });

    it('should parse and install from code', async () => {
      const code = `
        import minimatch from "minimatch" /* @9.0.0 */
        console.log(typeof minimatch)
      `;
      
      const deps = parseDeps(code);
      expect(deps).toEqual({ minimatch: '9.0.0' });
      
      await installDeps(deps, cwd);
      expect(load('minimatch').name).toBe('minimatch');
    });
  });
});