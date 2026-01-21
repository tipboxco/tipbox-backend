export type ThirdwebPostParams = {
  baseUrl: string;
  secretKey: string;
  timeoutMs: number;
  path: string;
  body: unknown;
};

/**
 * Thirdweb REST API'ye POST atar ve JSON döner.
 * Cache/logger içermez; sadece network + timeout + basic error handling yapar.
 */
export async function thirdwebPost<T>({
  baseUrl,
  secretKey,
  timeoutMs,
  path,
  body,
}: ThirdwebPostParams): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-secret-key': secretKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Thirdweb API error: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 500)}` : ''}`
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

