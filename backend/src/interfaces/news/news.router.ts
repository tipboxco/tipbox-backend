import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { NewsService } from '../../application/news/news.service';
import { ShareType } from '../../domain/interaction/share-type.enum';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const newsService = new NewsService();

router.use(authMiddleware);

/**
 * @openapi
 * /news/{newsId}:
 *   get:
 *     summary: News detayını getir
 *     description: Belirli bir news'in detaylı bilgilerini getirir. News'ler post olarak saklanır.
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *         description: News ID'si (post ID'si)
 *     responses:
 *       200:
 *         description: News detayı başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 source:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 image:
 *                   type: string
 *                   nullable: true
 *                 author:
 *                   type: string
 *                   nullable: true
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: News bulunamadı.
 */
router.get(
  '/:newsId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;
    if (!newsId) {
      return res.status(400).json({ message: 'newsId is required' });
    }

    const news = await newsService.getNewsById(newsId, userId);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    return res.json(news);
  })
);

/**
 * @openapi
 * /news/{newsId}/like:
 *   post:
 *     summary: News'i beğen
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News beğenildi
 *       400:
 *         description: Zaten beğenilmiş
 *       404:
 *         description: News bulunamadı
 */
router.post(
  '/:newsId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;

    try {
      await newsService.likeNews(userId, newsId);
      return res.status(200).json({
        success: true,
        message: 'News liked successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      if (errorMessage.includes('already liked')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error liking news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/like:
 *   delete:
 *     summary: News beğenisini geri al
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Beğeni geri alındı
 */
router.delete(
  '/:newsId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;

    try {
      await newsService.unlikeNews(userId, newsId);
      return res.status(200).json({
        success: true,
        message: 'News unliked successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not liked')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error unliking news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/comment:
 *   post:
 *     summary: News'e yorum ekle
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 description: Reply için parent comment ID
 *     responses:
 *       201:
 *         description: Yorum eklendi
 *       404:
 *         description: News bulunamadı
 */
router.post(
  '/:newsId/comment',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;
    const { comment, parentId } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    try {
      const commentResponse = await newsService.addComment(userId, newsId, comment.trim(), parentId);
      return res.status(201).json({
        success: true,
        data: commentResponse,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      logger.error(`Error adding comment to news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/comments:
 *   get:
 *     summary: News yorumlarını listele (bottom sheet için)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Yorumlar başarıyla getirildi
 */
router.get(
  '/:newsId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const limit = Math.min(Math.max(limitParam, 1), 100);
    const offset = Math.max(offsetParam, 0);

    try {
      const result = await newsService.getComments(newsId, limit, offset);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      logger.error(`Error getting comments for news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/comment/{commentId}/like:
 *   post:
 *     summary: News yorumunu beğen
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Yorum beğenildi
 */
router.post(
  '/:newsId/comment/:commentId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { commentId } = req.params;

    try {
      await newsService.likeComment(userId, commentId);
      return res.status(200).json({
        success: true,
        message: 'Comment liked successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      if (errorMessage.includes('already liked')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error liking comment ${commentId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/comment/{commentId}/like:
 *   delete:
 *     summary: News yorum beğenisini geri al
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Beğeni geri alındı
 */
router.delete(
  '/:newsId/comment/:commentId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { commentId } = req.params;

    try {
      await newsService.unlikeComment(userId, commentId);
      return res.status(200).json({
        success: true,
        message: 'Comment unliked successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not liked')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error unliking comment ${commentId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/share:
 *   post:
 *     summary: News'i paylaş
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shareType
 *             properties:
 *               shareType:
 *                 type: string
 *                 enum: [INTERNAL_REPOST, EXTERNAL_SHARE]
 *               platform:
 *                 type: string
 *     responses:
 *       201:
 *         description: News paylaşıldı
 */
router.post(
  '/:newsId/share',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;
    const { shareType, platform } = req.body;

    if (!shareType || !Object.values(ShareType).includes(shareType)) {
      return res.status(400).json({
        message: 'Valid shareType is required (INTERNAL_REPOST or EXTERNAL_SHARE)',
      });
    }

    try {
      await newsService.shareNews(userId, newsId, shareType as ShareType, platform);
      return res.status(201).json({
        success: true,
        message: 'News shared successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      if (errorMessage.includes('already shared')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error sharing news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/favorite:
 *   post:
 *     summary: News'i favorilere ekle (bookmark)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News favorilere eklendi
 */
router.post(
  '/:newsId/favorite',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;

    try {
      await newsService.favoriteNews(userId, newsId);
      return res.status(200).json({
        success: true,
        message: 'News favorited successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }
      if (errorMessage.includes('already favorited')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error favoriting news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /news/{newsId}/favorite:
 *   delete:
 *     summary: News'i favorilerden çıkar
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News favorilerden çıkarıldı
 */
router.delete(
  '/:newsId/favorite',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;

    try {
      await newsService.unfavoriteNews(userId, newsId);
      return res.status(200).json({
        success: true,
        message: 'News unfavorited successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not favorited')) {
        return res.status(400).json({ message: errorMessage });
      }
      logger.error(`Error unfavoriting news ${newsId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

export default router;

