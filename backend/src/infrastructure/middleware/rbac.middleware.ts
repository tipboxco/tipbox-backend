import { Request, Response, NextFunction } from 'express';
import { UserRolePrismaRepository } from '../repositories/user-role-prisma.repository';
import logger from '../logger/logger';
import { ForbiddenError, UnauthorizedError } from '../errors/custom-errors';

const userRoleRepo = new UserRolePrismaRepository();

/**
 * User role'lerini cache'lemek için helper
 */
const roleCache = new Map<string, { roles: string[]; timestamp: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

/**
 * Kullanıcının role'lerini getir (cache ile)
 */
async function getUserRoles(userId: string): Promise<string[]> {
  // Cache check
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
    return cached.roles;
  }
  
  // Database'den çek
  try {
    const userRoles = await userRoleRepo.findByUserId(userId);
    const roles = userRoles.map(ur => ur.role);
    
    // Cache'e kaydet
    roleCache.set(userId, {
      roles,
      timestamp: Date.now(),
    });
    
    return roles;
  } catch (error) {
    logger.error('Failed to get user roles', { error, userId });
    return [];
  }
}

/**
 * Cache'i temizleme (role değişikliklerinde çağrılmalı)
 */
export function clearRoleCache(userId: string): void {
  roleCache.delete(userId);
}

/**
 * Role-based access control middleware
 * Belirtilen role'lerden en az birine sahip olmayan kullanıcıları reddeder
 * 
 * @param roles - İzin verilen role listesi
 * @returns Express middleware
 * 
 * @example
 * ```typescript
 * router.delete(
 *   '/users/:id',
 *   authMiddleware,
 *   requireRole('ADMIN', 'MODERATOR'),
 *   deleteUserHandler
 * );
 * ```
 */
export const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // User bilgisini al (authMiddleware'den gelir)
      const user = req.user;
      
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }
      
      // Kullanıcının role'lerini al
      const userRoles = await getUserRoles(user.id);
      
      // Role kontrolü
      const hasRole = userRoles.some(userRole => 
        roles.includes(userRole)
      );
      
      if (!hasRole) {
        logger.warn('Insufficient permissions', {
          userId: user.id,
          requiredRoles: roles,
          userRoles,
          path: req.path,
          method: req.method,
        });
        
        throw new ForbiddenError(
          `Bu işlem için yetkiniz yok. Gerekli roller: ${roles.join(', ')}`
        );
      }
      
      // Role var, devam et
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based access control middleware
 * Belirli bir permission'a sahip olmayan kullanıcıları reddeder
 * 
 * NOT: Şu an için role-based, ileride permission tablosu eklenebilir
 * 
 * @param permission - Gerekli permission
 * @returns Express middleware
 * 
 * @example
 * ```typescript
 * router.post(
 *   '/posts/:id/pin',
 *   authMiddleware,
 *   requirePermission('post:pin'),
 *   pinPostHandler
 * );
 * ```
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }
      
      // Şu an permission tablosu yok, role'e göre permission map et
      const hasPermission = await checkUserPermission(user.id, permission);
      
      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: user.id,
          permission,
          path: req.path,
          method: req.method,
        });
        
        throw new ForbiddenError(
          `Bu işlem için yetkiniz yok. Gerekli izin: ${permission}`
        );
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission kontrolü helper
 * Şu an için basit role-based, ileride genişletilebilir
 */
async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  
  // Admin her şeyi yapabilir
  if (roles.includes('ADMIN')) {
    return true;
  }
  
  // Permission'a göre role mapping
  const permissionRoleMap: Record<string, string[]> = {
    // Post permissions
    'post:create': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'post:edit:own': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'post:edit:any': ['MODERATOR', 'ADMIN'],
    'post:delete:own': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'post:delete:any': ['MODERATOR', 'ADMIN'],
    'post:pin': ['MODERATOR', 'ADMIN'],
    
    // User permissions
    'user:edit:own': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'user:edit:any': ['ADMIN'],
    'user:delete:own': ['USER', 'EXPERT', 'BRAND'],
    'user:delete:any': ['ADMIN'],
    'user:ban': ['MODERATOR', 'ADMIN'],
    
    // Comment permissions
    'comment:create': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'comment:delete:own': ['USER', 'EXPERT', 'BRAND', 'MODERATOR', 'ADMIN'],
    'comment:delete:any': ['MODERATOR', 'ADMIN'],
    
    // Dashboard permissions
    'dashboard:view': ['MODERATOR', 'ADMIN'],
    'dashboard:edit': ['ADMIN'],
    
    // Product permissions
    'product:create': ['BRAND', 'ADMIN'],
    'product:edit': ['BRAND', 'ADMIN'],
    'product:delete': ['ADMIN'],
  };
  
  const allowedRoles = permissionRoleMap[permission] || [];
  return roles.some(role => allowedRoles.includes(role));
}

/**
 * Resource ownership kontrolü
 * Kullanıcının resource'un sahibi olup olmadığını kontrol eder
 * 
 * @param resourceUserId - Resource'un sahibinin user ID'si
 * @returns Express middleware
 * 
 * @example
 * ```typescript
 * router.put(
 *   '/posts/:id',
 *   authMiddleware,
 *   requireOwnership((req) => getPostOwnerId(req.params.id)),
 *   updatePostHandler
 * );
 * ```
 */
export const requireOwnership = (
  getResourceUserId: (req: Request) => Promise<string> | string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }
      
      // Resource owner ID'sini al
      const resourceUserId = await getResourceUserId(req);
      
      // Admin her şeyi yapabilir
      const roles = await getUserRoles(user.id);
      if (roles.includes('ADMIN') || roles.includes('MODERATOR')) {
        return next();
      }
      
      // Ownership kontrolü
      if (user.id !== resourceUserId) {
        logger.warn('Resource ownership denied', {
          userId: user.id,
          resourceUserId,
          path: req.path,
          method: req.method,
        });
        
        throw new ForbiddenError('Bu kaynağa erişim yetkiniz yok');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Admin-only middleware (shorthand)
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Moderator veya Admin middleware (shorthand)
 */
export const requireModerator = requireRole('MODERATOR', 'ADMIN');

export default {
  requireRole,
  requirePermission,
  requireOwnership,
  requireAdmin,
  requireModerator,
  clearRoleCache,
};

