import dotenv from 'dotenv';

dotenv.config();

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  timeout: number;
}

export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ortam değişkeni tanımlanmamış!');
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000', 10),
  };
}

