import { User } from '../user/user.entity';

export interface AuthService {
  authenticate(email: string, password: string): Promise<User | null>;
  register(email: string, password: string, name?: string): Promise<User>;
  validateToken(token: string): Promise<User | null>;
  getUserFromToken(token: string): Promise<User | null>;
} 