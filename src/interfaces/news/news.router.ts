import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { PostService } from '../../application/post/post.service';

const router = Router();
const postService = new PostService();

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
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newsId } = req.params;
    if (!newsId) {
      return res.status(400).json({ message: 'newsId is required' });
    }

    // Post service kullanarak news'i getir (news'ler post olarak saklanıyor)
    const post = await postService.getPostById(newsId);
    if (!post) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Post'u news formatına çevir
    // Post service feed formatında döndürüyor, bu yüzden doğru alanları kullanmalıyız
    const news = {
      id: post.id || newsId,
      title: post.title || '',
      content: post.content || post.body || '',
      source: post.user?.name || post.contextData?.name || 'tipbox',
      date: post.createdAt || new Date().toISOString(),
      image: post.images?.[0] || post.contextData?.image || null,
      author: post.user?.name || null,
      tags: post.tags?.map((tag: any) => (typeof tag === 'string' ? tag : tag.tag || tag.name || tag)) || [],
    };

    return res.json(news);
  })
);

export default router;

