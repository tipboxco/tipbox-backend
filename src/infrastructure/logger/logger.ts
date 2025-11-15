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
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
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