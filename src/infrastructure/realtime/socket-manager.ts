import { Server } from 'socket.io';
import { SocketHandler } from './socket.handler';

class SocketManager {
  private static instance: SocketManager;
  private socketHandler: SocketHandler | null = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public initialize(io: Server): void {
    if (this.socketHandler) {
      return;
    }

    this.socketHandler = new SocketHandler(io);
    this.socketHandler.initialize();
  }

  public getSocketHandler(): SocketHandler {
    if (!this.socketHandler) {
      throw new Error('SocketHandler not initialized. Call initialize() first.');
    }
    return this.socketHandler;
  }
}

export default SocketManager;
