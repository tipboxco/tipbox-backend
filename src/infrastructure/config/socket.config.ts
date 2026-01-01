import config from './index';
import logger from '../logger/logger';

export interface SocketConfig {
  cors: {
    origin: string[] | string | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods: string[];
    credentials: boolean;
  };
  transports: string[];
  allowEIO3: boolean;
  path?: string;
  connectTimeout?: number;
  pingTimeout?: number;
  pingInterval?: number;
}

class SocketConfigManager {
  private static instance: SocketConfigManager;
  private config: SocketConfig | null = null;

  private constructor() {}

  public static getInstance(): SocketConfigManager {
    if (!SocketConfigManager.instance) {
      SocketConfigManager.instance = new SocketConfigManager();
    }
    return SocketConfigManager.instance;
  }

  public initialize(): SocketConfig {
    if (this.config) {
      return this.config;
    }

    // Config modülünden ortam bazlı CORS ayarlarını al
    // Development ve test ortamlarında TÜM origin'lere izin ver (*)
    // Production ortamında config'deki origin'leri kullan
    const corsOrigin = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Development ve test ortamlarında HER YERDEN erişime izin ver
          // Not: credentials: true ile birlikte origin: '*' kullanılamaz,
          // bu yüzden function-based kontrol ile her zaman true döndürüyoruz
          
          // Debug logging (development ortamında)
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`Socket CORS check - Origin: ${origin || 'undefined/null'} - ALLOWING (development mode)`);
          }
          
          // Tüm origin'lere izin ver
          callback(null, true);
        }
      : config.corsOrigins;

    this.config = {
      cors: {
        origin: corsOrigin,
        methods: config.corsMethods,
        credentials: true,
      },
      // React Native/Expo için websocket öncelikli
      // Docker ortamında polling bazen takılabilir, websocket daha güvenilir
      transports: ['websocket', 'polling'] as const,
      allowEIO3: false,
      // Socket.IO pathname (default: /socket.io/)
      path: '/socket.io/',
      // Connection timeout (ms) - 20 saniye
      connectTimeout: 20000,
      // Ping timeout (ms) - 5 saniye
      pingTimeout: 5000,
      // Ping interval (ms) - 25 saniye
      pingInterval: 25000,
    };

    return this.config;
  }

  public getConfig(): SocketConfig {
    if (!this.config) {
      return this.initialize();
    }
    return this.config;
  }
}

export default SocketConfigManager;
