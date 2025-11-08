import { Router, Request, Response } from 'express';
import { InventoryService } from '../../application/inventory/inventory.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
const inventoryService = new InventoryService();

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

