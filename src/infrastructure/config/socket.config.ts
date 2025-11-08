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

    // CORS origins from environment variable
    const corsOrigins = process.env.CORS_ORIGINS || 'http://localhost:3000';
    const origins = corsOrigins.split(',').map(origin => origin.trim());

    // CORS methods from environment variable
    const corsMethods = process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS';
    const methods = corsMethods.split(',').map(method => method.trim());

    this.config = {
      cors: {
        origin: origins,
        methods,
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
