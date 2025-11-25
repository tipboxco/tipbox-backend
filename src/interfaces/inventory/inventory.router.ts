import { Router, Request, Response } from 'express';
import { InventoryService } from '../../application/inventory/inventory.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { CreateInventoryRequest } from './inventory.dto';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';

const router = Router();
const inventoryService = new InventoryService();

/**
 * @openapi
 * /inventory:
 *   post:
 *     summary: Inventory'ye yeni ürün ekle
 *     description: Kullanıcının sahip olduğu veya test ettiği bir ürünü inventory listesine ekler, deneyimlerini ve görsellerini kaydeder.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - selectedDurationId
 *               - selectedLocationId
 *               - selectedPurposeId
 *               - content
 *               - experience
 *               - status
 *             properties:
 *               productId:
 *                 type: string
 *               selectedDurationId:
 *                 type: string
 *               selectedLocationId:
 *                 type: string
 *               selectedPurposeId:
 *                 type: string
 *               content:
 *                 type: string
 *               experience:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [type, content, rating]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [price_and_shopping, product_and_usage]
 *                     content:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *               status:
 *                 type: string
 *                 enum: [own, tested]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Görsel URL listesi
 *     responses:
 *       201:
 *         description: Inventory item başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItemResponse'
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const body = req.body as CreateInventoryRequest;
    const errors: string[] = [];

    if (body.userId && body.userId !== userId) {
      return res.status(403).json({ message: 'Payload userId does not match authenticated user' });
    }

    if (!body.productId || typeof body.productId !== 'string') {
      errors.push('productId is required');
    }

    if (!body.selectedDurationId || typeof body.selectedDurationId !== 'string') {
      errors.push('selectedDurationId is required');
    }

    if (!body.selectedLocationId || typeof body.selectedLocationId !== 'string') {
      errors.push('selectedLocationId is required');
    }

    if (!body.selectedPurposeId || typeof body.selectedPurposeId !== 'string') {
      errors.push('selectedPurposeId is required');
    }

    if (!body.content || typeof body.content !== 'string') {
      errors.push('content is required');
    }

    if (!Array.isArray(body.experience) || body.experience.length === 0) {
      errors.push('experience must be a non-empty array');
    } else {
      body.experience.forEach((exp, index) => {
        if (!exp.type || typeof exp.type !== 'string') {
          errors.push(`experience[${index}].type is required`);
        }
        if (!exp.content || typeof exp.content !== 'string') {
          errors.push(`experience[${index}].content is required`);
        }
        if (
          typeof exp.rating !== 'number' ||
          Number.isNaN(exp.rating) ||
          exp.rating < 1 ||
          exp.rating > 5
        ) {
          errors.push(`experience[${index}].rating must be between 1 and 5`);
        }
      });
    }

    if (!body.status || !Object.values(ExperienceStatus).includes(body.status as ExperienceStatus)) {
      errors.push('status must be one of own or tested');
    }

    if (body.images) {
      if (!Array.isArray(body.images)) {
        errors.push('images must be an array of URLs');
      } else if (body.images.some((img) => typeof img !== 'string')) {
        errors.push('images must contain only string URLs');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const created = await inventoryService.createInventoryItem(String(userId), {
      ...body,
      images: body.images || [],
    });

    res.status(201).json(created);
  })
);

/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Kullanıcının sahip olduğu ürünlerin listesini getir
 *     description: Kullanıcının sahip olduğu tüm ürünleri brand, reviews, image ve tags bilgileriyle birlikte getirir.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcının inventory listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryListItemResponse'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await inventoryService.getUserInventoryList(userId);
    res.json(result);
  })
);

/**
 * @openapi
 * /inventory/{inventoryId}:
 *   patch:
 *     summary: Kullanıcının sahip olduğu ürünlerin listesinde düzenleme yap
 *     description: Kullanıcının sahip olduğu bir ürünün bilgilerini günceller. hasOwned ve experienceSummary alanları güncellenebilir.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Inventory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hasOwned:
 *                 type: boolean
 *                 description: Ürünün sahip olunma durumu
 *               experienceSummary:
 *                 type: string
 *                 description: Ürün deneyimi özeti
 *     responses:
 *       200:
 *         description: Inventory item başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItemResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Inventory does not belong to user
 *       404:
 *         description: Inventory item not found
 */
router.patch(
  '/:inventoryId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { inventoryId } = req.params;
    const { hasOwned, experienceSummary } = req.body;

    if (!inventoryId) {
      return res.status(400).json({ message: 'Inventory ID is required' });
    }

    try {
      const result = await inventoryService.updateInventoryItem(userId, inventoryId, {
        hasOwned,
        experienceSummary,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inventory/{inventoryId}:
 *   delete:
 *     summary: Kullanıcının sahip olduğu ürünlerin içerisinden ürün kaldır
 *     description: Kullanıcının sahip olduğu bir ürünü inventory'den kaldırır.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Inventory ID
 *     responses:
 *       200:
 *         description: Inventory item başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Inventory does not belong to user
 *       404:
 *         description: Inventory item not found
 */
router.delete(
  '/:inventoryId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { inventoryId } = req.params;

    if (!inventoryId) {
      return res.status(400).json({ message: 'Inventory ID is required' });
    }

    try {
      const success = await inventoryService.deleteInventoryItem(userId, inventoryId);
      if (success) {
        res.json({ success: true, message: 'Inventory item deleted successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to delete inventory item' });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

export default router;

