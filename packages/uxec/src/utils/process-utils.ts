import { platform } from 'node:os';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  ppid: number;
  command: string;
  cpu?: number;
  memory?: number;
}

export class ProcessUtils {
  /**
   * Get the default shell for the current platform
   */
  static getDefaultShell(): string {
    const platformName = platform();
    
    switch (platformName) {
      case 'win32':
        return process.env['COMSPEC'] || 'cmd.exe';
      case 'darwin':
      case 'linux':
      case 'freebsd':
      case 'openbsd':
      case 'sunos':
        return process.env['SHELL'] || '/bin/sh';
      default:
        return '/bin/sh';
    }
  }

  /**
   * Check if a shell is available
   */
  static async isShellAvailable(shell: string): Promise<boolean> {
    try {
      if (platform() === 'win32') {
        const { stdout } = await execAsync(`where ${shell}`);
        return stdout.trim().length > 0;
      } else {
        const { stdout } = await execAsync(`which ${shell}`);
        return stdout.trim().length > 0;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get preferred shell from common options
   */
  static async getPreferredShell(): Promise<string> {
    const shells = platform() === 'win32'
      ? ['pwsh.exe', 'powershell.exe', 'cmd.exe']
      : ['bash', 'zsh', 'fish', 'sh'];

    for (const shell of shells) {
      if (await this.isShellAvailable(shell)) {
        return shell;
      }
    }

    return this.getDefaultShell();
  }

  /**
   * Kill process tree
   */
  static async killProcessTree(pid: number, signal: string = 'SIGTERM'): Promise<void> {
    if (platform() === 'win32') {
      try {
        await execAsync(`taskkill /pid ${pid} /T /F`);
      } catch {
        // Process might already be dead
      }
    } else {
      try {
        // Use process group to kill all child processes
        process.kill(-pid, signal as any);
      } catch {
        // Try direct kill if group kill fails
        try {
          process.kill(pid, signal as any);
        } catch {
          // Process might already be dead
        }
      }
    }
  }

  /**
   * Get process tree
   */
  static async getProcessTree(pid: number): Promise<ProcessInfo[]> {
    const processes: ProcessInfo[] = [];
    
    if (platform() === 'win32') {
      try {
        const { stdout } = await execAsync(
          `wmic process where (ParentProcessId=${pid}) get ProcessId,ParentProcessId,CommandLine /format:csv`
        );
        
        const lines = stdout.trim().split('\n').slice(2); // Skip headers
        for (const line of lines) {
          const [, command, ppid, pid] = line.split(',');
          if (pid) {
            processes.push({
              pid: parseInt(pid || '0', 10),
              ppid: parseInt(ppid || '0', 10),
              command: command || ''
            });
          }
        }
      } catch {
        // WMIC might not be available
      }
    } else {
      try {
        const { stdout } = await execAsync(`ps -o pid,ppid,comm -p ${pid}`);
        const lines = stdout.trim().split('\n').slice(1); // Skip header
        
        for (const line of lines) {
          const match = line.match(/\s*(\d+)\s+(\d+)\s+(.+)/);
          if (match) {
            processes.push({
              pid: parseInt(match[1] || '0', 10),
              ppid: parseInt(match[2] || '0', 10),
              command: match[3] || ''
            });
          }
        }
        
        // Get children recursively
        const { stdout: childrenOutput } = await execAsync(`pgrep -P ${pid}`);
        const childPids = childrenOutput.trim().split('\n').filter(Boolean);
        
        for (const childPid of childPids) {
          const children = await this.getProcessTree(parseInt(childPid, 10));
          processes.push(...children);
        }
      } catch {
        // Process might not exist
      }
    }
    
    return processes;
  }

  /**
   * Check if process is running
   */
  static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for process to exit
   */
  static async waitForProcessExit(pid: number, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!this.isProcessRunning(pid)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }

  /**
   * Get environment variables with platform-specific handling
   */
  static getEnvironment(customEnv?: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Copy process.env, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    
    if (customEnv) {
      for (const [key, value] of Object.entries(customEnv)) {
        // Handle special cases like PATH
        if (key.toUpperCase() === 'PATH' && env['PATH']) {
          // Append to existing PATH
          const separator = platform() === 'win32' ? ';' : ':';
          env['PATH'] = `${env['PATH']}${separator}${value}`;
        } else {
          env[key] = value;
        }
      }
    }
    
    return env;
  }

  /**
   * Escape shell argument for the current platform
   */
  static escapeShellArg(arg: string): string {
    if (platform() === 'win32') {
      // Windows escaping
      if (!/[\s"\\]/.test(arg)) {
        return arg;
      }
      
      // Escape backslashes that precede quotes
      arg = arg.replace(/(\\*)"/, '$1$1\\"');
      
      // Escape trailing backslashes
      arg = arg.replace(/(\\*)$/, '$1$1');
      
      // Wrap in quotes
      return `"${arg}"`;
    } else {
      // Unix escaping - use single quotes and escape embedded single quotes
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
  }

  /**
   * Parse command line into command and arguments
   */
  static parseCommandLine(commandLine: string): { command: string; args: string[] } {
    // Simple parser - doesn't handle all edge cases
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];
      const nextChar = commandLine[i + 1];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar && commandLine[i - 1] !== '\\') {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return {
      command: parts[0] || '',
      args: parts.slice(1)
    };
  }
}