// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import assert from 'node:assert'
import { test, describe } from 'node:test'

import {
  $,
  cd,
  fs,
  ps,
  os,
  log,
  kill,
  YAML,
  argv,
  glob,
  echo,
  path,
  quiet,
  chalk,
  which,
  quote,
  sleep,
  fetch,
  stdin,
  retry,
  dotenv,
  within,
  globby,
  tmpdir,
  nothrow,
  version,
  VERSION,
  usePwsh,
  useBash,
  spinner,
  tempdir,
  tmpfile,
  defaults,
  minimist,
  question,
  tempfile,
  parseArgv,
  updateArgv,
  expBackoff,
  usePowerShell,
  ProcessOutput,
  syncProcessCwd,
  ProcessPromise,
  quotePowerShell,
} from '../build/index.js'

describe('index', () => {
  test('has proper exports', () => {
    // index
    assert(nothrow)
    assert(quiet)
    assert(version)
    assert.equal(version, VERSION)

    // core
    assert($)
    assert(ProcessOutput)
    assert(ProcessPromise)
    assert(cd)
    assert(syncProcessCwd)
    assert(log)
    assert(kill)
    assert(defaults)
    assert(within)
    assert(usePowerShell)
    assert(usePwsh)
    assert(useBash)

    // goods
    assert(os)
    assert(argv)
    assert(parseArgv)
    assert(updateArgv)
    assert(globby)
    assert(glob)
    assert(sleep)
    assert(fetch)
    assert(echo)
    assert(question)
    assert(stdin)
    assert(retry)
    assert(expBackoff)
    assert(spinner)
    assert(path)

    // vendor
    assert(minimist)
    assert(chalk)
    assert(fs)
    assert(which)
    assert(YAML)
    assert(ps)
    assert(dotenv)

    // utils
    assert(quote)
    assert(quotePowerShell)
    assert(tempdir)
    assert(tmpdir)
    assert(tmpfile)
    assert(tempfile)
  })
})
