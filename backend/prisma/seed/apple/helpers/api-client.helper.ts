import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export interface AuthTokenResult {
  token: string;
  userId: string;
  email: string;
}

/**
 * Login endpoint'inden auth token al
 */
export async function getAuthToken(
  email: string,
  password: string = 'password123'
): Promise<AuthTokenResult> {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password,
    });

    if (!response.data.token) {
      throw new Error(`Login başarısız: Token alınamadı. Response: ${JSON.stringify(response.data)}`);
    }

    return {
      token: response.data.token,
      userId: response.data.id || response.data.userId || '',
      email,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string; success?: boolean }>;
      const message = axiosError.response?.data?.message || axiosError.message;
      throw new Error(`Login hatası (${email}): ${message}`);
    }
    throw error;
  }
}

/**
 * Token ile authenticated HTTP isteği at
 */
export async function makeAuthenticatedRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  token: string,
  data?: any
): Promise<any> {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string; success?: boolean }>;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.message || axiosError.message;
      
      // 400, 401, 404, 500, socket hang up gibi hataları logla ama fırlatma
      if (status === 400 || status === 401 || status === 404 || status === 500 || !status) {
        // Sadece ilk birkaç hatayı logla, sonra sessizce atla
        return null;
      }
      
      throw new Error(`${method} ${url} - ${status}: ${message}`);
    }
    // Socket hang up gibi network hatalarını da yoksay
    return null;
  }
}

/**
 * Tüm kullanıcılar için token'ları toplu al
 */
export async function getUserTokens(
  users: Array<{ id: string; email: string }>
): Promise<Map<string, AuthTokenResult>> {
  const tokenMap = new Map<string, AuthTokenResult>();
  
  console.log(`🔐 ${users.length} kullanıcı için token alınıyor...`);
  
  for (const user of users) {
    try {
      const authResult = await getAuthToken(user.email, 'password123');
      tokenMap.set(user.id, authResult);
    } catch (error) {
      console.warn(`⚠️  ${user.email} için token alınamadı: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`✅ ${tokenMap.size} kullanıcı için token alındı`);
  return tokenMap;
}

/**
 * Gerçek kullanıcı email'lerini al
 */
export function getUserEmails(): Array<{ id: string; email: string }> {
  const { TEST_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } = require('../../types');
  
  const users: Array<{ id: string; email: string }> = [
    { id: TEST_USER_ID, email: 'omer@tipbox.co' },
    ...TRUST_USER_IDS.map((id: string, index: number) => ({
      id,
      email: `trust-user-${index}@tipbox.co`,
    })),
    ...TRUSTER_USER_IDS.map((id: string, index: number) => ({
      id,
      email: `truster-user-${index}@tipbox.co`,
    })),
  ];
  
  return users;
}
