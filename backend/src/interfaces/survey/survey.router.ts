import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { BrandService } from '../../application/brand/brand.service';

const router = Router();
const brandService = new BrandService();

router.use(authMiddleware);

/**
 * @openapi
 * /surveys/{surveyId}/questions:
 *   get:
 *     summary: Anket sorularını getirir
 *     description: Belirtilen anketin tüm sorularını ve seçeneklerini döner.
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Anket ID'si
 *     responses:
 *       200:
 *         description: Anket soruları başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveyId:
 *                   type: string
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       options:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             text:
 *                               type: string
 *                       order:
 *                         type: integer
 *                 totalQuestions:
 *                   type: integer
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Anket bulunamadı.
 */
router.get(
  '/:surveyId/questions',
  asyncHandler(async (req: Request, res: Response) => {
    const { surveyId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await brandService.getSurveyQuestions(surveyId, userId);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /surveys/{surveyId}/questions/{questionId}/answer:
 *   post:
 *     summary: Anket cevabını gönderir
 *     description: Belirtilen soruya verilen cevabı kaydeder veya günceller.
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Anket ID'si
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Soru ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answerId
 *             properties:
 *               answerId:
 *                 type: string
 *                 description: Seçilen cevap ID'si
 *     responses:
 *       200:
 *         description: Cevap başarıyla kaydedildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 isCompleted:
 *                   type: boolean
 *                   description: Tüm sorulara cevap verildiyse true
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Anket veya soru bulunamadı.
 */
router.post(
  '/:surveyId/questions/:questionId/answer',
  asyncHandler(async (req: Request, res: Response) => {
    const { surveyId, questionId } = req.params;
    const { answerId } = req.body;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!answerId) {
      return res.status(400).json({ success: false, message: 'answerId is required' });
    }

    const result = await brandService.submitSurveyAnswer(surveyId, questionId, userId, answerId);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /surveys/{surveyId}/complete:
 *   post:
 *     summary: Anketi tamamla ve puan kazan
 *     description: Tüm soruları cevaplanan anketi tamamlar, kullanıcıya puan verir ve badge kontrolü yapar.
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Anket ID'si
 *     responses:
 *       200:
 *         description: Anket başarıyla tamamlandı, puan ve badge bilgileri döndü.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 pointsAwarded:
 *                   type: integer
 *                 totalSurveyPoints:
 *                   type: integer
 *                 badgesEarned:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Anket henüz tamamlanmadı veya zaten tamamlanmış.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Anket bulunamadı.
 */
router.post(
  '/:surveyId/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const { surveyId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await brandService.completeSurvey(surveyId, userId);
    return res.json(result);
  }),
);

export default router;
