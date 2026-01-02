import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { InteractionService } from '../../application/interaction/interaction.service';
import { ShareType } from '../../domain/interaction/share-type.enum';

const router = Router();
const interactionService = new InteractionService();

router.use(authMiddleware);

// ========== LIKE ENDPOINTS ==========

/**
 * @openapi
 * /interactions/posts/{postId}/like:
 *   post:
 *     summary: Post'u beğen
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post beğenildi
 *       400:
 *         description: Zaten beğenilmiş
 *       401:
 *         description: Yetkisiz
 */
router.post(
  '/posts/:postId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;

    await interactionService.likePost(userId, postId);

    return res.status(200).json({
      success: true,
      message: 'Post liked successfully',
    });
  })
);

/**
 * @openapi
 * /interactions/posts/{postId}/like:
 *   delete:
 *     summary: Post beğenisini geri al
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Beğeni geri alındı
 */
router.delete(
  '/posts/:postId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;

    await interactionService.unlikePost(userId, postId);

    return res.status(200).json({
      success: true,
      message: 'Post unliked successfully',
    });
  })
);

// ========== BOOKMARK ENDPOINTS ==========

/**
 * @openapi
 * /interactions/posts/{postId}/bookmark:
 *   post:
 *     summary: Post'u favorilere ekle
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorilere eklendi
 */
router.post(
  '/posts/:postId/bookmark',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;

    const favorite = await interactionService.favoritePost(userId, postId);

    return res.status(200).json({
      success: true,
      data: favorite,
      message: 'Post bookmarked successfully',
    });
  })
);

/**
 * @openapi
 * /interactions/posts/{postId}/bookmark:
 *   delete:
 *     summary: Favorilerden çıkar
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorilerden çıkarıldı
 */
router.delete(
  '/posts/:postId/bookmark',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;

    await interactionService.unfavoritePost(userId, postId);

    return res.status(200).json({
      success: true,
      message: 'Post unbookmarked successfully',
    });
  })
);

/**
 * @openapi
 * /interactions/bookmarks:
 *   get:
 *     summary: Kullanıcının favorilerini getir
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Favoriler listelendi
 */
router.get(
  '/bookmarks',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const favorites = await interactionService.getUserFavorites(userId, limit);

    return res.status(200).json({
      success: true,
      data: favorites,
    });
  })
);

// ========== COMMENT ENDPOINTS ==========

/**
 * @openapi
 * /interactions/posts/{postId}/comments:
 *   post:
 *     summary: Post'a yorum yap
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                 description: Yorum metni
 *               parentId:
 *                 type: string
 *                 description: Reply ise parent comment ID
 *     responses:
 *       201:
 *         description: Yorum oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 comment:
 *                   type: string
 *                 createdAt:
 *                   type: string
 */
router.post(
  '/posts/:postId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { comment, parentId } = req.body;

    if (!comment) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const createdComment = await interactionService.createComment(
      userId,
      postId,
      comment,
      parentId
    );

    return res.status(201).json({
      success: true,
      data: createdComment,
    });
  })
);

/**
 * @openapi
 * /interactions/posts/{postId}/comments:
 *   get:
 *     summary: Post'un yorumlarını getir
 *     tags: [Interactions]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Yorumlar listelendi
 */
router.get(
  '/posts/:postId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await interactionService.getPostComments(postId, limit);

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @openapi
 * /interactions/comments/{commentId}:
 *   delete:
 *     summary: Yorumu sil
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Yorum silindi
 */
router.delete(
  '/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { commentId } = req.params;

    await interactionService.deleteComment(userId, commentId);

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  })
);

/**
 * @openapi
 * /interactions/comments/{commentId}/like:
 *   post:
 *     summary: Yorumu beğen
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
  '/comments/:commentId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { commentId } = req.params;

    await interactionService.likeComment(userId, commentId);

    return res.status(200).json({
      success: true,
      message: 'Comment liked successfully',
    });
  })
);

/**
 * @openapi
 * /interactions/comments/{commentId}/like:
 *   delete:
 *     summary: Yorum beğenisini geri al
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
  '/comments/:commentId/like',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { commentId } = req.params;

    await interactionService.unlikeComment(userId, commentId);

    return res.status(200).json({
      success: true,
      message: 'Comment unliked successfully',
    });
  })
);

// ========== SHARE ENDPOINTS ==========

/**
 * @openapi
 * /interactions/posts/{postId}/share:
 *   post:
 *     summary: Post'u paylaş
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *               - shareType
 *             properties:
 *               shareType:
 *                 type: string
 *                 enum: [INTERNAL_REPOST, EXTERNAL_SHARE]
 *               platform:
 *                 type: string
 *                 description: Dış platform adı (EXTERNAL_SHARE için)
 *     responses:
 *       201:
 *         description: Post paylaşıldı
 */
router.post(
  '/posts/:postId/share',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { shareType, platform } = req.body;

    if (!shareType || !Object.values(ShareType).includes(shareType)) {
      return res.status(400).json({
        message: 'Valid shareType is required (INTERNAL_REPOST or EXTERNAL_SHARE)',
      });
    }

    const share = await interactionService.sharePost(
      userId,
      postId,
      shareType as ShareType,
      platform
    );

    return res.status(201).json({
      success: true,
      data: share,
    });
  })
);

// ========== STATUS ENDPOINTS ==========

/**
 * @openapi
 * /interactions/posts/{postId}/status:
 *   get:
 *     summary: Kullanıcının post ile etkileşim durumu
 *     tags: [Interactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Etkileşim durumu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liked:
 *                   type: boolean
 *                 favorited:
 *                   type: boolean
 *                 shared:
 *                   type: boolean
 */
router.get(
  '/posts/:postId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { postId } = req.params;

    const status = await interactionService.getUserInteractionStatus(userId, postId);

    return res.status(200).json({
      success: true,
      data: status,
    });
  })
);

export default router;

