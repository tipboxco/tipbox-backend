import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { adminLogin as apiLogin } from '../api/auth';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
};

type AuthState = {
  token: string | null;
  user: AdminUser | null;
  isReady: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): { token: string | null; user: AdminUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!token) return { token: null, user: null };
    const user = userJson ? (JSON.parse(userJson) as AdminUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isReady: false,
  });

  useEffect(() => {
    const { token, user } = loadStored();
    setState({ token, user, isReady: true });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    const user: AdminUser = {
      id: data.id,
      email: data.email,
      fullName: data.fullName,
      avatar: data.avatar,
    };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token: data.token, user, isReady: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, isReady: true });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    isAuthenticated: !!state.token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
