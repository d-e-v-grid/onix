// Copyright 2022 Google LLC
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

import 'zx/globals'

import assert from 'node:assert'
import { expectType } from 'tsd'
import { ParsedArgs } from 'minimist'

const p = $`cmd`
assert(p instanceof ProcessPromise)
expectType<ProcessPromise>(p)

const o = await p
assert(o instanceof ProcessOutput)
expectType<ProcessOutput>(o)

expectType<string>(quote('foo'))
expectType<string>(quotePowerShell('foo'))

expectType<ParsedArgs>(minimist(['--foo', 'bar']))
