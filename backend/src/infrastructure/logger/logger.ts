import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import config from '../config';

const env = config.nodeEnv;
const logLevel = config.logLevel;
const logRetentionDays = config.logRetentionDays;

const logDir = path.resolve(process.cwd(), 'logs');

// Log dizini yoksa oluştur (Docker/read-only ortamda yazılamazsa file transport eklenmez)
function ensureLogDir(): boolean {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    return Object.assign({}, info, {
      message: info.message,
      stack: info.stack,
    });
  }
  return info;
})();

const MESSAGE = Symbol.for('message');

/** Döngüsel referans ve çok derin nesnelerde JSON.stringify stack overflow önler; dosya yazımında çökme olmaz */
const safeJsonFormat = format((info) => {
  try {
    const seen = new WeakSet();
    const replacer = (_key: string, value: unknown): unknown => {
      if (value !== null && typeof value === 'object') {
        if (seen.has(value as object)) return '[Circular]';
        seen.add(value as object);
      }
      return value;
    };
    (info as Record<symbol, string>)[MESSAGE] = JSON.stringify(info, replacer as (key: string, value: unknown) => unknown);
  } catch (_e) {
    (info as Record<symbol, string>)[MESSAGE] = JSON.stringify({
      level: info.level,
      message: info.message,
      timestamp: (info as Record<string, unknown>).timestamp,
      meta: '[Log meta stringify failed: circular or too deep]',
    });
  }
  return info;
})();

// Ortam bazlı console log level
// Development: debug, Test: info, Production: warn (console'da sadece warn ve error)
const consoleLogLevel = env === 'production' ? 'warn' : logLevel;

// Ortam bazlı file log level
// Tüm ortamlarda file'a info ve üzeri yazılır
const fileLogLevel = 'info';

// File transport'ları sadece log dizini yazılabilirse ekle (Docker/read-only ortamda çökme önlenir)
const fileTransports: InstanceType<typeof DailyRotateFile>[] = [];
if (ensureLogDir()) {
  try {
    const mainFile = new DailyRotateFile({
      dirname: logDir,
      filename: `%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: `${logRetentionDays}d`,
      level: fileLogLevel,
    });
    const errorFile = new DailyRotateFile({
      dirname: logDir,
      filename: `%DATE%-error.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: `${Math.ceil(logRetentionDays * 1.5)}d`,
      level: 'error',
    });
    [mainFile, errorFile].forEach((t) => {
      t.on('error', (err) => {
        // Yazma hatası (disk dolu, permission vb.) uygulamayı çökertmesin
        // Not: console.error burada bilinçli - logger kendi transport hatasını loglarken kendini kullanamaz
        console.error('[logger] File transport error:', err.message); // eslint-disable-line no-console
      });
    });
    fileTransports.push(mainFile, errorFile);
  } catch (_) {
    // Transport oluşturulamazsa sadece console kullan
  }
}

const logger: Logger = createLogger({
  level: logLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  format: format.combine(
    enumerateErrorFormat,
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    safeJsonFormat
  ),
  transports: [
    new transports.Console({
      level: consoleLogLevel,
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length) {
            try {
              const seen = new WeakSet();
              const replacer = (key: string, value: unknown): unknown => {
                if (typeof value === 'object' && value !== null) {
                  if (seen.has(value)) return '[Circular]';
                  seen.add(value);
                  if (value.constructor?.name && ['Socket', 'IncomingMessage', 'ClientRequest'].includes(value.constructor.name)) {
                    return `[${value.constructor.name}]`;
                  }
                }
                return value;
              };
              metaStr = JSON.stringify(meta, replacer as (key: string, value: unknown) => unknown, 2);
            } catch (error) {
              metaStr = `{ "error": "Failed to stringify meta: ${error instanceof Error ? error.message : String(error)}" }`;
            }
          }
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
    ...fileTransports,
  ],
  exitOnError: false,
});

export default logger; 