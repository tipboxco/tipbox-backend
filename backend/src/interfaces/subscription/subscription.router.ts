import { Router, Request, Response } from 'express';
import { SubscriptionPlanService } from '../../application/payment/subscription-plan.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { SubscriptionPlanResponse } from '../payment/payment.dto';

const router = Router();
router.use(authMiddleware);

const subscriptionPlanService = new SubscriptionPlanService();

/**
 * @openapi
 * /subscription/plans:
 *   get:
 *     summary: Mevcut abonelik paketlerini listele
 *     description: Aktif paketleri (id, name, price, period, benefits) döner.
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paket listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlanResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const plans = await subscriptionPlanService.listPlans();
  const response: SubscriptionPlanResponse[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    period: p.period,
    benefits: p.benefits,
  }));
  return res.json(response);
}));

export default router;
