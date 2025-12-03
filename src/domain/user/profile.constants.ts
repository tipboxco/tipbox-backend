import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_PROFILE_BANNER_URL =
  process.env.DEFAULT_PROFILE_BANNER_URL || '';
