import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_PROFILE_BANNER_URL =
  process.env.DEFAULT_PROFILE_BANNER_URL ||
  'http://10.20.0.17:9000/tipbox-media/profile-banners/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-banner.png';
