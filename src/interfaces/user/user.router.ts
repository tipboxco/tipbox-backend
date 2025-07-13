import { Router, Request, Response } from 'express';
import { UserService } from '../../application/user/user.service';
import { CreateUserRequest, UserResponse } from './user.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';

const router = Router();
const userService = new UserService();

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Kullanıcı oluştur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Oluşturulan kullanıcı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email, name } = req.body as CreateUserRequest;
  const user = await userService.createUser(email ?? '', name ?? undefined);
  const response: UserResponse = {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    auth0Id: user.auth0Id,
    walletAddress: user.walletAddress,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
  res.status(201).json(response);
}));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Kullanıcıyı ID ile getir
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Kullanıcı ID
 *     responses:
 *       200:
 *         description: Kullanıcı bulundu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = await userService.getUserById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const response: UserResponse = {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    auth0Id: user.auth0Id,
    walletAddress: user.walletAddress,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
  res.json(response);
}));

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Tüm kullanıcıları listele
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserResponse'
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const users = await userService.listUsers();
  res.json(users.map(user => ({
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    auth0Id: user.auth0Id,
    walletAddress: user.walletAddress,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  })));
}));

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Kullanıcıyı güncelle
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Kullanıcı ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Güncellenen kullanıcı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { email, name } = req.body;
  const user = await userService.updateUser(id, { email, name });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    auth0Id: user.auth0Id,
    walletAddress: user.walletAddress,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  });
}));

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Kullanıcıyı sil
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Kullanıcı ID
 *     responses:
 *       204:
 *         description: Başarıyla silindi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const ok = await userService.deleteUser(id);
  if (!ok) return res.status(404).json({ message: 'User not found' });
  res.status(204).send();
}));

export default router; 