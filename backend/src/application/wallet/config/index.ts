import dotenv from "dotenv";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? "development";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const rawLogLevel = process.env.LOG_LEVEL ?? (NODE_ENV === "production" ? "info" : "debug");
const LOG_LEVEL = ["error", "warn", "info", "http", "verbose", "debug", "silly"].includes(rawLogLevel)
  ? rawLogLevel
  : rawLogLevel.split(",")[0]?.trim() || (NODE_ENV === "production" ? "info" : "debug");
const THIRDWEB_USER_ID = process.env.THIRDWEB_USER_ID ?? "";

export const config = {
  nodeEnv: NODE_ENV,
  port: PORT,
  logLevel: LOG_LEVEL,
  thirdwebUserId: THIRDWEB_USER_ID,
  isDevelopment: NODE_ENV === "development",
  isProduction: NODE_ENV === "production",
} as const;
