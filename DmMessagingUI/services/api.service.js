// API Service
export async function apiFetch(path, options = {}, panelState) {
  if (!panelState) {
    console.error('apiFetch: panelState is undefined', { path, options });
    throw new Error('panelState is required');
  }

  // baseUrl kontrolü - boş string veya geçersiz değerleri kontrol et
  let baseUrl = panelState.baseUrl;
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    baseUrl = 'http://localhost:3000';
    console.warn('apiFetch: baseUrl is missing or invalid, using default:', baseUrl);
  }
  
  // Trailing slash kontrolü
  baseUrl = baseUrl.trim().replace(/\/+$/, '');
  
  const fullUrl = `${baseUrl}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (panelState.token) {
    headers.Authorization = `Bearer ${panelState.token}`;
  }

  console.log('apiFetch:', { method: options.method || 'GET', url: fullUrl, hasToken: !!panelState.token, baseUrl });

  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(rawText || 'API isteği başarısız');
  }

  if (!rawText || res.status === 204) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

