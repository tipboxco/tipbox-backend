export interface WelcomeDepositConfig {
  sourceUserEmail: string;
  amount: number;
  enabled: boolean;
}

const DEFAULT_SOURCE_EMAIL = 'iguzel657@gmail.com';
const DEFAULT_AMOUNT = 100;

export function getWelcomeDepositConfig(): WelcomeDepositConfig {
  const sourceUserEmail =
    process.env.WELCOME_DEPOSIT_SOURCE_USER_EMAIL ?? DEFAULT_SOURCE_EMAIL;
  return {
    sourceUserEmail,
    amount: Number(process.env.WELCOME_DEPOSIT_AMOUNT ?? DEFAULT_AMOUNT),
    enabled: sourceUserEmail.length > 0,
  };
}
