import { RewardClaimPrismaRepository } from '../../infrastructure/repositories/reward-claim-prisma.repository';
import { TransactionService } from '../transaction/transaction.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { RewardClaim } from '../../domain/reward/reward-claim.entity';
import { RewardClaimType } from '../../domain/reward/reward-claim-type.enum';
import { RewardSourceType } from '../../domain/reward/reward-source-type.enum';
import { RewardClaimStatus } from '../../domain/reward/reward-claim-status.enum';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { CreateRewardClaimDTO } from '../../infrastructure/repositories/reward-claim.repository.interface';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

export interface ClaimRewardResult {
  success: boolean;
  rewardClaim?: RewardClaim;
  transactionId?: string;
  error?: string;
}

export interface ClaimAllRewardsResult {
  success: boolean;
  totalAmount: number;
  claimedCount: number;
  failedCount: number;
  transactionId?: string;
  claims: RewardClaim[];
  errors?: string[];
}

export interface RewardClaimSummary {
  totalPending: number;
  totalClaimable: number;
  totalAmount: number;
  bySourceType: {
    [key: string]: {
      count: number;
      amount: number;
      claims: Array<{ id: string; amount: number; earnedAt: Date; metadata: RewardClaim['metadata'] }>;
    };
  };
}

export class RewardClaimService {
  private readonly rewardClaimRepo: RewardClaimPrismaRepository;
  private readonly transactionService: TransactionService;
  private readonly notificationService: NotificationService;
  private readonly prisma: ReturnType<typeof getPrisma>;

  constructor() {
    this.rewardClaimRepo = new RewardClaimPrismaRepository();
    this.transactionService = new TransactionService();
    this.notificationService = new NotificationService();
    this.prisma = getPrisma();
  }

  /**
   * Yeni reward claim oluştur
   */
  async createRewardClaim(data: CreateRewardClaimDTO): Promise<RewardClaim> {
    try {
      logger.info(`Creating reward claim for user ${data.userId}`, data);
      const rewardClaim = await this.rewardClaimRepo.create(data);

      // Send notification asynchronously
      this.notificationService.sendNotification(
        data.userId,
        NotificationType.REWARD_CLAIMABLE,
        {
          amount: data.amount,
          sourceType: data.sourceType,
          rewardType: data.rewardType,
          rewardClaimId: rewardClaim.id,
          metadata: data.metadata,
        }
      ).catch(error => {
        logger.error('Error sending reward claimable notification:', error);
      });

      return rewardClaim;
    } catch (error) {
      logger.error('Error creating reward claim:', error);
      throw error;
    }
  }

  /**
   * Kullanıcının tüm claimable reward'larını getir
   */
  async getClaimableRewards(userId: string): Promise<RewardClaim[]> {
    try {
      return await this.rewardClaimRepo.findClaimableByUserId(userId);
    } catch (error) {
      logger.error(`Error getting claimable rewards for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının reward claim summary'sini getir
   */
  async getRewardClaimSummary(userId: string): Promise<RewardClaimSummary> {
    try {
      const claimableRewards = await this.getClaimableRewards(userId);
      const totalAmount = await this.rewardClaimRepo.getTotalClaimableAmount(userId);

      // SourceType'a göre grupla
      const bySourceType: RewardClaimSummary['bySourceType'] = {};

      for (const claim of claimableRewards) {
        const sourceType = claim.sourceType;
        if (!bySourceType[sourceType]) {
          bySourceType[sourceType] = {
            count: 0,
            amount: 0,
            claims: [],
          };
        }

        bySourceType[sourceType].count++;
        bySourceType[sourceType].amount += claim.amount;
        bySourceType[sourceType].claims.push({
          id: claim.id,
          amount: claim.amount,
          earnedAt: claim.earnedAt,
          metadata: claim.metadata,
        });
      }

      // Birden fazla ödül varsa bildirim gönder
      const claimableCount = claimableRewards.filter((c) => c.isClaimable()).length;
      if (claimableCount >= 3) {
        this.notificationService.sendNotification(
          userId,
          NotificationType.MULTIPLE_REWARDS_AVAILABLE,
          {
            count: claimableCount,
            totalAmount,
            rewards: claimableRewards.map(c => ({
              id: c.id,
              amount: c.amount,
              sourceType: c.sourceType,
            })),
          }
        ).catch(error => {
          logger.error('Error sending multiple rewards notification:', error);
        });
      }

      return {
        totalPending: claimableRewards.length,
        totalClaimable: claimableCount,
        totalAmount,
        bySourceType,
      };
    } catch (error) {
      logger.error(`Error getting reward claim summary for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Source type'a göre reward claim'leri getir
   */
  async getRewardsBySourceType(userId: string, sourceType: RewardSourceType): Promise<RewardClaim[]> {
    try {
      const allClaims = await this.rewardClaimRepo.getClaimsBySourceType(userId, sourceType);
      return allClaims.filter((claim) => claim.isClaimable());
    } catch (error) {
      logger.error(`Error getting rewards by source type for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Tek bir reward'ı claim et
   * ✅ ÖNEMLİ: Event reward'ları için kullanıcının event'e join olması gerekir
   */
  async claimReward(userId: string, rewardClaimId: string): Promise<ClaimRewardResult> {
    try {
      // Reward claim'i getir
      const rewardClaim = await this.rewardClaimRepo.findById(rewardClaimId);

      if (!rewardClaim) {
        return {
          success: false,
          error: 'Reward claim not found',
        };
      }

      // Kullanıcıya ait mi kontrol et
      if (rewardClaim.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      // ✅ YENİ: Event reward'ları için join kontrolü
      if (rewardClaim.sourceType === RewardSourceType.EVENT_PARTICIPATION) {
        const eventId = rewardClaim.metadata?.eventId;
        if (eventId) {
          const userStats = await this.prisma.eventStats.findUnique({
            where: {
              userId_eventId: {
                userId,
                eventId: eventId as string,
              },
            },
          });

          if (!userStats) {
            return {
              success: false,
              error: 'You must join the event before claiming rewards',
            };
          }
        }
      }

      // Claimable mı kontrol et
      if (!rewardClaim.isClaimable()) {
        return {
          success: false,
          error: 'Reward is not claimable',
        };
      }

      // Transaction oluştur
      const wallet = await this.transactionService['walletRepo'].findActiveByUserId(userId);
      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found',
        };
      }

      const transaction = await this.transactionService['transactionRepo'].create({
        walletId: wallet.id,
        actionType: TransactionActionType.CLAIM_REWARD,
        amount: rewardClaim.amount,
        fromAddress: null,
        toAddress: wallet.smartAccountAddress ?? wallet.publicAddress,
        metadata: {
          rewardClaimId: rewardClaim.id,
          rewardType: String(rewardClaim.rewardType),
          sourceType: String(rewardClaim.sourceType),
          metadata: rewardClaim.metadata ? JSON.parse(JSON.stringify(rewardClaim.metadata)) : null,
        },
        provider: 'backend',
      });

      if (!transaction) {
        return {
          success: false,
          error: 'Failed to create transaction',
        };
      }

      // Transaction'ı hemen confirm et (backend transaction olduğu için)
      // confirmTransaction içinde balance güncelleniyor
      await this.transactionService.confirmTransaction(transaction.id);

      // Reward claim'i claimed olarak işaretle
      const updatedClaim = await this.rewardClaimRepo.markAsClaimed(rewardClaimId, transaction.id);

      if (!updatedClaim) {
        return {
          success: false,
          error: 'Failed to mark reward as claimed',
        };
      }

      logger.info(`Reward claim ${rewardClaimId} claimed successfully by user ${userId}`);

      // Send notification asynchronously
      this.notificationService.sendNotification(
        userId,
        NotificationType.REWARD_CLAIMED,
        {
          amount: updatedClaim.amount,
          rewardType: updatedClaim.rewardType,
          sourceType: updatedClaim.sourceType,
          rewardClaimId: updatedClaim.id,
          transactionId: transaction.id,
        }
      ).catch(error => {
        logger.error('Error sending reward claimed notification:', error);
      });

      return {
        success: true,
        rewardClaim: updatedClaim,
        transactionId: transaction.id,
      };
    } catch (error) {
      logger.error(`Error claiming reward ${rewardClaimId} for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Kullanıcının tüm claimable reward'larını tek seferde claim et
   */
  async claimAllRewards(userId: string): Promise<ClaimAllRewardsResult> {
    try {
      const claimableRewards = await this.getClaimableRewards(userId);

      if (claimableRewards.length === 0) {
        return {
          success: true,
          totalAmount: 0,
          claimedCount: 0,
          failedCount: 0,
          claims: [],
        };
      }

      // Toplam miktar
      const totalAmount = claimableRewards.reduce((sum, claim) => sum + claim.amount, 0);

      // Tek bir transaction oluştur
      const wallet = await this.transactionService['walletRepo'].findActiveByUserId(userId);
      if (!wallet) {
        return {
          success: false,
          totalAmount: 0,
          claimedCount: 0,
          failedCount: claimableRewards.length,
          claims: [],
          errors: ['Wallet not found'],
        };
      }

      const transaction = await this.transactionService['transactionRepo'].create({
        walletId: wallet.id,
        actionType: TransactionActionType.CLAIM_REWARD,
        amount: totalAmount,
        fromAddress: null,
        toAddress: wallet.smartAccountAddress ?? wallet.publicAddress,
        metadata: {
          claimCount: claimableRewards.length,
          claimIds: claimableRewards.map((c) => c.id),
        },
        provider: 'backend',
      });

      if (!transaction) {
        return {
          success: false,
          totalAmount: 0,
          claimedCount: 0,
          failedCount: claimableRewards.length,
          claims: [],
          errors: ['Failed to create transaction'],
        };
      }

      // Transaction'ı hemen confirm et (backend transaction olduğu için)
      // confirmTransaction içinde balance güncelleniyor
      await this.transactionService.confirmTransaction(transaction.id);

      // Tüm reward'ları claim et
      const claimedRewards: RewardClaim[] = [];
      const errors: string[] = [];

      for (const claim of claimableRewards) {
        try {
          const updatedClaim = await this.rewardClaimRepo.markAsClaimed(claim.id, transaction.id);
          if (updatedClaim) {
            claimedRewards.push(updatedClaim);
          } else {
            errors.push(`Failed to claim reward ${claim.id}`);
          }
        } catch (error) {
          errors.push(`Error claiming reward ${claim.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      logger.info(`Claimed ${claimedRewards.length} rewards for user ${userId}, total amount: ${totalAmount}`);

      // Send notification asynchronously
      this.notificationService.sendNotification(
        userId,
        NotificationType.REWARD_CLAIMED,
        {
          amount: totalAmount,
          count: claimedRewards.length,
          transactionId: transaction.id,
          claimIds: claimedRewards.map(c => c.id),
        }
      ).catch(error => {
        logger.error('Error sending batch reward claimed notification:', error);
      });

      return {
        success: true,
        totalAmount,
        claimedCount: claimedRewards.length,
        failedCount: claimableRewards.length - claimedRewards.length,
        transactionId: transaction.id,
        claims: claimedRewards,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error(`Error claiming all rewards for user ${userId}:`, error);
      return {
        success: false,
        totalAmount: 0,
        claimedCount: 0,
        failedCount: 0,
        claims: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Expired reward'ları işaretle
   */
  async markExpiredRewards(): Promise<number> {
    try {
      const expiredClaims = await this.rewardClaimRepo.findExpiredClaims();
      let markedCount = 0;

      for (const claim of expiredClaims) {
        const updated = await this.rewardClaimRepo.markAsExpired(claim.id);
        if (updated) {
          markedCount++;

          // Send expiration notification
          this.notificationService.sendNotification(
            claim.userId,
            NotificationType.REWARD_EXPIRED,
            {
              amount: claim.amount,
              sourceType: claim.sourceType,
              rewardType: claim.rewardType,
              rewardClaimId: claim.id,
              expiredAt: new Date(),
            }
          ).catch(error => {
            logger.error('Error sending reward expired notification:', error);
          });
        }
      }

      logger.info(`Marked ${markedCount} expired reward claims`);
      return markedCount;
    } catch (error) {
      logger.error('Error marking expired rewards:', error);
      throw error;
    }
  }

  /**
   * Kullanıcının claim history'sini getir
   */
  async getClaimHistory(userId: string): Promise<RewardClaim[]> {
    try {
      return await this.rewardClaimRepo.findByUserId(userId, {
        status: RewardClaimStatus.CLAIMED,
      });
    } catch (error) {
      logger.error(`Error getting claim history for user ${userId}:`, error);
      throw error;
    }
  }
}
