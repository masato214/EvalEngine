import { z } from 'zod';

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  AI_SERVICE_URL: z.string().url(),
  AI_INTERNAL_KEY: z.string().min(16),
  API_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const aiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_INTERNAL_KEY: z.string().min(16),
  AI_PORT: z.coerce.number().default(8000),
});

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type AiEnv = z.infer<typeof aiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
