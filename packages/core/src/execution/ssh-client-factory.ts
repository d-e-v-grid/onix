import { SSHClient } from './ssh-client.js';
import { MockSSHClient } from './mock-ssh-client.js';
import { ISSHClient, SSHConnectionOptions } from '../types/ssh.js';

export class SSHClientFactory {
  static createClient(config: SSHConnectionOptions, useMock = false, commandMocks?: Record<string, any>): ISSHClient {
    if (useMock) {
      return new MockSSHClient(commandMocks);
    }
    return new SSHClient(config);
  }
}