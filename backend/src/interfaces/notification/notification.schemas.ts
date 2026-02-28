import { z } from 'zod';

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  deviceType: z.enum(['ios', 'android', 'web']),
});

export const UpdateNotificationSettingsSchema = z.object({
  trustNotifications: z.boolean().optional(),
  supportNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  collectionNotifications: z.boolean().optional(),
  postNotifications: z.boolean().optional(),
  nftNotifications: z.boolean().optional(),
  rewardNotifications: z.boolean().optional(),
  transactionNotifications: z.boolean().optional(),
  walletNotifications: z.boolean().optional(),
  gamificationNotifications: z.boolean().optional(),
  expertNotifications: z.boolean().optional(),
  eventNotifications: z.boolean().optional(),
  systemNotifications: z.boolean().optional(),
  notificationEmailEnabled: z.boolean().optional(),
  notificationPushEnabled: z.boolean().optional(),
  notificationInAppEnabled: z.boolean().optional(),
  receiveNotifications: z.boolean().nullable().optional(),
});

export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;
export type UpdateNotificationSettingsInput = z.infer<typeof UpdateNotificationSettingsSchema>;
