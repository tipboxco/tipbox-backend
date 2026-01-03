import { buildMediaUrl } from '../../../infrastructure/config/media.config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Media helper for notification tests
 * Handles MinIO media paths and test asset paths
 */
export class MediaHelper {
  /**
   * Get test avatar path from assets
   */
  static getTestAvatarPath(filename?: string): string {
    const assetsDir = path.join(process.cwd(), 'tests', 'assets', 'userprofile');
    const files = fs.readdirSync(assetsDir);
    const avatarFile = filename || files.find(f => f.endsWith('.jpg') || f.endsWith('.png')) || files[0];
    return path.join(assetsDir, avatarFile);
  }

  /**
   * Get test post image path from assets
   */
  static getTestPostImagePath(filename?: string): string {
    const assetsDir = path.join(process.cwd(), 'tests', 'assets', 'post');
    if (!fs.existsSync(assetsDir)) {
      // Fallback to product images
      const productDir = path.join(process.cwd(), 'tests', 'assets', 'product');
      if (fs.existsSync(productDir)) {
        const files = fs.readdirSync(productDir);
        const imageFile = filename || files.find(f => f.endsWith('.jpg') || f.endsWith('.png')) || files[0];
        return path.join(productDir, imageFile);
      }
    }
    const files = fs.readdirSync(assetsDir);
    const imageFile = filename || files.find(f => f.endsWith('.jpg') || f.endsWith('.png')) || files[0];
    return path.join(assetsDir, imageFile);
  }

  /**
   * Get MinIO media path for a given type and filename
   * Returns relative path that will be stored in database
   */
  static getMediaPath(type: 'avatar' | 'post' | 'product', filename: string): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    
    switch (type) {
      case 'avatar':
        return `profile-pictures/${randomId}/${timestamp}-${filename}`;
      case 'post':
        return `post-media/${randomId}/${timestamp}-${filename}`;
      case 'product':
        return `products/${randomId}/${timestamp}-${filename}`;
      default:
        return `media/${randomId}/${timestamp}-${filename}`;
    }
  }

  /**
   * Build full media URL from relative path
   * Uses SEED_MEDIA_BASE_URL from environment
   */
  static buildFullMediaUrl(relativePath: string): string {
    return buildMediaUrl(relativePath);
  }

  /**
   * Validate SEED_MEDIA_BASE_URL is set
   */
  static validateEnvironment(): void {
    if (!process.env.SEED_MEDIA_BASE_URL) {
      throw new Error(
        'SEED_MEDIA_BASE_URL environment variable is required! ' +
        'Set it in your .env file (e.g., SEED_MEDIA_BASE_URL=http://192.168.1.195:9000)'
      );
    }
  }
}



