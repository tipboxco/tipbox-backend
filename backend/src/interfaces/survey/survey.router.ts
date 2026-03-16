import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { BrandService } from '../../application/brand/brand.service';

const router = Router();
const brandService = new BrandService();

router.use(authMiddleware);

/**
 * @openapi
 * /api/surveys/{surveyId}/questions:
 *   get:
 *     summary: Get survey questions
 *     description: Returns all questions and options for the specified survey.
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
 *         description: Survey ID
 *     responses:
 *       200:
 *         description: Survey questions retrieved successfully.
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
 *                       type:
 *                         type: string
 *                         enum: [TEXT, SINGLE_CHOICE, MULTIPLE_CHOICE]
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
 *                       isAnswered:
 *                         type: boolean
 *                 totalQuestions:
 *                   type: integer
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Survey not found.
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
 * /api/surveys/{surveyId}/submit:
 *   post:
 *     summary: Submit all survey answers at once
 *     description: >
 *       Submits all answers for a survey in a single request, completes the survey,
 *       awards points, and checks for badge eligibility.
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
 *         description: Survey ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - answerId
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                     answerId:
 *                       type: string
 *                       description: Selected option ID or text answer
 *     responses:
 *       200:
 *         description: Survey submitted and completed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 awardedPoints:
 *                   type: integer
 *                 newTotalPoints:
 *                   type: integer
 *                 badgesEarned:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       image:
 *                         type: string
 *                       rarity:
 *                         type: string
 *       400:
 *         description: Invalid request or survey already completed.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Survey not found.
 */
router.post(
  '/:surveyId/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const { surveyId } = req.params;
    const { answers } = req.body;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: 'answers array is required' });
    }

    // Validate each answer has required fields
    for (const answer of answers) {
      if (!answer.questionId || !answer.answerId) {
        return res
          .status(400)
          .json({ success: false, message: 'Each answer must have questionId and answerId' });
      }
    }

    const result = await brandService.submitSurvey(surveyId, userId, answers);
    return res.json(result);
  }),
);

export default router;
