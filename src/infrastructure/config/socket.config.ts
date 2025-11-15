import config from './index';

export interface SocketConfig {
  cors: {
    origin: string[];
    methods: string[];
    credentials: boolean;
  };
  transports: string[];
  allowEIO3: boolean;
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
    this.config = {
      cors: {
        origin: config.corsOrigins,
        methods: config.corsMethods,
        credentials: true,
      },
      transports: ['websocket', 'polling'] as const,
      allowEIO3: false,
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
