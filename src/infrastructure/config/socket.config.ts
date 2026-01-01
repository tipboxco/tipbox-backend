import config from './index';
import { getCorsOptions } from './cors.config';

export interface SocketConfig {
  cors: {
    origin: string[] | string | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods: string[];
    credentials: boolean;
  };
  transports: string[];
  allowEIO3: boolean;
  path: string;
  connectTimeout: number;
  pingTimeout: number;
  pingInterval: number;
}

export function getSocketConfig(): SocketConfig {
  const corsOptions = getCorsOptions();
  
  return {
    cors: {
      origin: corsOptions.origin as any,
      methods: config.corsMethods,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: false,
    path: '/socket.io/',
    connectTimeout: 20000,
    pingTimeout: 5000,
    pingInterval: 25000,
  };
}
