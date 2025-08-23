/**
 * Logger utility for the broadcast CLI tool
 */
export class Logger {
  constructor(level = 'info') {
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.level = this.levels[level] || 1;
  }

  debug(...args) {
    if (this.level <= 0) console.log('🔍 DEBUG:', ...args);
  }

  info(...args) {
    if (this.level <= 1) console.log('ℹ️  INFO:', ...args);
  }

  warn(...args) {
    if (this.level <= 2) console.warn('⚠️  WARN:', ...args);
  }

  error(...args) {
    if (this.level <= 3) console.error('❌ ERROR:', ...args);
  }
}

export default Logger;