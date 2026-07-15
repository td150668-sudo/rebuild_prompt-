const DEBUG_ENABLED = process.env.DEBUG === 'remotedebug' || process.env.DEBUG === '*';

class LoggerUtil {
  log(msg: string, ...args: any[]) {
    console.log.apply(this, [msg, ...args]);
  }

  error(msg: string) {
    console.error(msg);
  }
}

export function debug(msg: string, ...args: any[]): void {
  if (DEBUG_ENABLED) {
    console.log(`[remotedebug] ${msg}`, ...args);
  }
}

export const Logger = new LoggerUtil();
