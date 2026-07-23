export interface DailyRewardConfig {
  sourceUserEmail: string;
  amount: number;
  intervalSeconds: number;
  enabled: boolean;
}

const DEFAULT_SOURCE_EMAIL = 'iguzel657@gmail.com';
const DEFAULT_AMOUNT = 100;
const DEFAULT_INTERVAL_HOURS = 12;

export function getDailyRewardConfig(): DailyRewardConfig {
  const sourceUserEmail =
    process.env.DAILY_REWARD_SOURCE_USER_EMAIL ?? DEFAULT_SOURCE_EMAIL;
  const intervalHours = Number(
    process.env.DAILY_REWARD_INTERVAL_HOURS ?? DEFAULT_INTERVAL_HOURS,
  );
  return {
    sourceUserEmail,
    amount: Number(process.env.DAILY_REWARD_AMOUNT ?? DEFAULT_AMOUNT),
    intervalSeconds: intervalHours * 3600,
    enabled: sourceUserEmail.length > 0,
  };
}
