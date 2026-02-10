/**
 * Admin login — POST /admin/login
 * Backend returns { id, email, fullName, avatar, token, refreshToken } on success.
 */

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) return '';
  return url.replace(/\/$/, '');
};

export type AdminLoginRequest = {
  email: string;
  password: string;
};

export type AdminLoginSuccess = {
  id: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
  token: string;
  refreshToken: string;
};

export type AdminLoginError = {
  success: false;
  message: string;
};

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminLoginSuccess> {
  const base = getBaseUrl();
  const url = `${base}/admin/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (json as AdminLoginError).message ||
      (res.status === 401 ? 'Invalid email or password' : 'Login failed');
    throw new Error(msg);
  }

  return json as AdminLoginSuccess;
}
