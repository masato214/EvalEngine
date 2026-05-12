const FALLBACK_PUBLIC_API_URL = 'https://evalengine-api-2aq8.onrender.com/api/v1';

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return FALLBACK_PUBLIC_API_URL;
}
