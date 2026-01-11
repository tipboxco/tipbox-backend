import { Router, Request, Response } from 'express';
import { EventPostService } from '../../application/event/event-post.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const eventPostService = new EventPostService();

/**
 * @openapi
 * /events/{eventId}/posts:
 *   post:
 *     summary: Event'e post oluştur
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               body:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Post başarıyla oluşturuldu
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:eventId/posts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { eventId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ message: 'Title must be at most 200 characters' });
    }

    if (body.length > 2000) {
      return res.status(400).json({ message: 'Body must be at most 2000 characters' });
    }

    try {
      const post = await eventPostService.createEventPost({
        eventId,
        userId: String(userId),
        title,
        body,
      });

      return res.status(201).json(post);
    } catch (error: any) {
      if (error.message === 'Event not found') {
        return res.status(404).json({ message: 'Event not found' });
      }
      if (error.message.includes('not started') || error.message.includes('ended') || error.message.includes('not published')) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/posts:
 *   get:
 *     summary: Event post'larını listele
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Post listesi
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:eventId/posts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { eventId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (limit && (limit < 1 || limit > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const posts = await eventPostService.getEventPosts(eventId, {
      cursor,
      limit,
      userId: userId ? String(userId) : undefined,
    });

    return res.json(posts);
  })
);

/**
 * @openapi
 * /events/{eventId}/posts/{postId}:
 *   get:
 *     summary: Event post detayı
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post detayı
 *       404:
 *         description: Post not found
 */
router.get(
  '/:eventId/posts/:postId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { postId } = req.params;

    try {
      const post = await eventPostService.getEventPostDetail(
        postId,
        userId ? String(userId) : undefined
      );

      return res.json(post);
    } catch (error: any) {
      if (error.message === 'Post not found') {
        return res.status(404).json({ message: 'Post not found' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/posts/{postId}:
 *   delete:
 *     summary: Event post'u sil
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Post başarıyla silindi
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.delete(
  '/:eventId/posts/:postId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { postId } = req.params;

    try {
      await eventPostService.deleteEventPost(postId, String(userId));
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Post not found') {
        return res.status(404).json({ message: 'Post not found' });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/posts/{postId}/like:
 *   post:
 *     summary: Post'u beğen/beğeniyi kaldır
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like toggle başarılı
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:eventId/posts/:postId/like',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { postId } = req.params;

    const result = await eventPostService.toggleLike(postId, String(userId));

    return res.json(result);
  })
);

/**
 * @openapi
 * /events/{eventId}/posts/{postId}/comments:
 *   post:
 *     summary: Post'a yorum yap
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: postId
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
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Yorum başarıyla eklendi
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:eventId/posts/:postId/comments',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { postId } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    if (comment.length > 500) {
      return res.status(400).json({ message: 'Comment must be at most 500 characters' });
    }

    try {
      const newComment = await eventPostService.addComment(postId, String(userId), comment);
      return res.status(201).json(newComment);
    } catch (error: any) {
      if (error.message === 'Post not found') {
        return res.status(404).json({ message: 'Post not found' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/posts/{postId}/comments:
 *   get:
 *     summary: Post yorumlarını listele
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Yorum listesi
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:eventId/posts/:postId/comments',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { postId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (limit && (limit < 1 || limit > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const comments = await eventPostService.getPostComments(postId, {
      cursor,
      limit,
    });

    return res.json(comments);
  })
);

export default router;

