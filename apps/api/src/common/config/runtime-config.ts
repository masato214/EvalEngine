const FALLBACK_AI_SERVICE_URL = 'https://evalengine-ai.vercel.app';

export function getAiServiceUrl() {
  const configured = process.env.AI_SERVICE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return FALLBACK_AI_SERVICE_URL;
}
