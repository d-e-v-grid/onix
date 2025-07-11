import { ZodObject } from 'zod'
import { StreamFactory } from './streams/stream-factory'

export interface StreamConfig {
  name: string
  schema: ZodObject<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  baseConfig:
    | { storageType: 'default' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { storageType: 'custom'; factory: () => MotiaStream<any> }
}

export type StateStreamEventChannel = { groupId: string; id?: string }
export type StateStreamEvent<TData> = { type: string; data: TData }

export type BaseStreamItem<TData = unknown> = TData & { id: string }

export type Stream<TConfig extends StreamConfig = StreamConfig> = {
  filePath: string
  config: TConfig
  hidden?: boolean
  factory: StreamFactory<unknown>
}

export interface MotiaStream<TData> {
  get(groupId: string, id: string): Promise<BaseStreamItem<TData> | null>
  set(groupId: string, id: string, data: TData): Promise<BaseStreamItem<TData>>
  delete(groupId: string, id: string): Promise<BaseStreamItem<TData> | null>
  getGroup(groupId: string): Promise<BaseStreamItem<TData>[]>

  send<T>(channel: StateStreamEventChannel, event: StateStreamEvent<T>): Promise<void>
}
