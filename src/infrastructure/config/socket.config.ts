import config from './index';

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
    // Development ortamında tüm origin'lere izin ver (geliştirme kolaylığı için)
    const corsOrigin = process.env.NODE_ENV === 'development' 
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Development'ta tüm origin'lere izin ver
          callback(null, true);
        }
      : config.corsOrigins;

    this.config = {
      cors: {
        origin: corsOrigin,
        methods: config.corsMethods,
        credentials: true,
      },
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
