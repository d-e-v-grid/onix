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

import { default as _chalk } from 'chalk'
import { default as _which } from 'which'
import { default as _ps } from '@webpod/ps'

import { bus } from './internals.js'

export { type ChalkInstance } from 'chalk'

export type RequestInfo = Parameters<typeof globalThis.fetch>[0]
export type RequestInit = Parameters<typeof globalThis.fetch>[1] & {
  signal?: AbortSignal
}

import {
  exec,
  buildCmd,
  VoidStream,
  isStringLiteral,
  type TSpawnStore,
  type TSpawnResult,
  type TSpawnStoreChunks,
} from 'zurk'

export {
  exec,
  buildCmd,
  VoidStream,
  isStringLiteral,
  type TSpawnStore,
  type TSpawnResult,
  type TSpawnStoreChunks,
}
export const chalk: typeof _chalk = bus.wrap('chalk', _chalk)
export const which: typeof _which = bus.wrap('which', _which)
export const ps: typeof _ps = bus.wrap('ps', _ps)
