import { Router, Request, Response } from 'express';
import { AuthService } from '../../application/auth/auth.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';

const router = Router();
const authService = new AuthService();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Başarılı giriş ve JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Geçersiz bilgiler
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await authService.authenticate(email, password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const token = authService.generateToken(user);
  res.json({ token });
}));

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               name:
 *                 type: string
 *                 example: Omer Faruk
 *     responses:
 *       201:
 *         description: Başarılı kayıt ve JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const user = await authService.register(email, password, name);
  const token = authService.generateToken(user);
  res.status(201).json({ token });
}));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Giriş yapan kullanıcının bilgilerini getir
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 auth0Id:
 *                   type: string
 *                 walletAddress:
 *                   type: string
 *                 kycStatus:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *       401:
 *         description: Yetkisiz veya geçersiz token
 */
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const user = await authService.getUserFromToken(token);
  if (!user) return res.status(401).json({ message: 'Invalid token' });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    auth0Id: user.auth0Id,
    walletAddress: user.walletAddress,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
}));

export default router; 