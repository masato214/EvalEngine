export const QUEUE_NAMES = {
  ANALYSIS: 'analysis',
} as const;

export const API_KEY_HEADER = 'x-api-key';
export const TENANT_ID_HEADER = 'x-tenant-id';
export const INTERNAL_KEY_HEADER = 'x-internal-key';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const EMBEDDING_DIMENSIONS = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
} as const;
