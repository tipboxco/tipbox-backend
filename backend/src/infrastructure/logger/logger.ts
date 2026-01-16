import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import config from '../config';

const env = config.nodeEnv;
const logLevel = config.logLevel;
const logRetentionDays = config.logRetentionDays;

const logDir = path.resolve(process.cwd(), 'logs');

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    return Object.assign({}, info, {
      message: info.message,
      stack: info.stack,
    });
  }
  return info;
});

// Ortam bazlı console log level
// Development: debug, Test: info, Production: warn (console'da sadece warn ve error)
const consoleLogLevel = env === 'production' ? 'warn' : logLevel;

// Ortam bazlı file log level
// Tüm ortamlarda file'a info ve üzeri yazılır
const fileLogLevel = 'info';

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
    enumerateErrorFormat(),
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      level: consoleLogLevel,
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          // Circular reference'ları handle et
          const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key: string, value: any) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return '[Circular]';
                }
                seen.add(value);
                // Socket, Stream gibi özel objeleri basitleştir
                if (value.constructor && value.constructor.name) {
                  if (['Socket', 'IncomingMessage', 'ClientRequest'].includes(value.constructor.name)) {
                    return `[${value.constructor.name}]`;
                  }
                }
              }
              return value;
            };
          };
          
          let metaStr = '';
          if (Object.keys(meta).length) {
            try {
              metaStr = JSON.stringify(meta, getCircularReplacer(), 2);
            } catch (error) {
              // JSON.stringify başarısız olursa, sadece error message'ı göster
              metaStr = `{ "error": "Failed to stringify meta: ${error instanceof Error ? error.message : String(error)}" }`;
            }
          }
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: `%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: `${logRetentionDays}d`,
      level: fileLogLevel,
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: `%DATE%-error.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      // Error loglar daha uzun süre saklanır (production'da 90 gün, diğerlerinde retention * 1.5)
      maxFiles: `${Math.ceil(logRetentionDays * 1.5)}d`,
      level: 'error',
    }),
  ],
  exitOnError: false,
});

export default logger; 