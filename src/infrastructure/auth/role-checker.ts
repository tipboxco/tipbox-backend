import { UserRolePrismaRepository } from '../repositories/user-role-prisma.repository';
import logger from '../logger/logger';

const userRoleRepo = new UserRolePrismaRepository();

/**
 * Kullanıcının belirli bir role sahip olup olmadığını kontrol eder
 */
export async function hasRole(userId: string, role: string): Promise<boolean> {
  try {
    const userRoles = await userRoleRepo.findByUserId(userId);
    return userRoles.some(ur => ur.role === role);
  } catch (error) {
    logger.error('Failed to check user role', { error, userId, role });
    return false;
  }
}

/**
 * Kullanıcının role'lerinden herhangi birine sahip olup olmadığını kontrol eder
 */
export async function hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
  try {
    const userRoles = await userRoleRepo.findByUserId(userId);
    const userRoleNames = userRoles.map(ur => ur.role);
    return roles.some(role => userRoleNames.includes(role));
  } catch (error) {
    logger.error('Failed to check user roles', { error, userId, roles });
    return false;
  }
}

/**
 * Kullanıcının tüm role'lere sahip olup olmadığını kontrol eder
 */
export async function hasAllRoles(userId: string, roles: string[]): Promise<boolean> {
  try {
    const userRoles = await userRoleRepo.findByUserId(userId);
    const userRoleNames = userRoles.map(ur => ur.role);
    return roles.every(role => userRoleNames.includes(role));
  } catch (error) {
    logger.error('Failed to check user roles', { error, userId, roles });
    return false;
  }
}

/**
 * Kullanıcının admin olup olmadığını kontrol eder
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, 'ADMIN');
}

/**
 * Kullanıcının moderator veya admin olup olmadığını kontrol eder
 */
export async function isModerator(userId: string): Promise<boolean> {
  return hasAnyRole(userId, ['MODERATOR', 'ADMIN']);
}

export default {
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAdmin,
  isModerator,
};

