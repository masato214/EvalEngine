const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type ApiRequestOptions = {
  tenantId?: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  requestOptions: ApiRequestOptions = {},
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  if (requestOptions.tenantId) (headers as Record<string, string>)['x-tenant-id'] = requestOptions.tenantId;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'API error');
  }

  const json = await res.json();
  return json.data !== undefined ? json : json;
}

export const apiClient = {
  get: <T = any>(path: string, token?: string, options?: ApiRequestOptions) => request<T>(path, {}, token, options),
  post: <T = any>(path: string, body: unknown, token?: string, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token, options),
  put: <T = any>(path: string, body: unknown, token?: string, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, token, options),
  delete: <T = any>(path: string, token?: string, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'DELETE' }, token, options),
};
