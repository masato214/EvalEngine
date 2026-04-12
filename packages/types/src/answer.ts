export interface AnswerItemPayload {
  questionId: string;
  value: string | string[] | number;
}

export interface SubmitAnswerPayload {
  modelId: string;
  respondentRef: string;
  respondentMeta?: Record<string, unknown>;
  items: AnswerItemPayload[];
}

export interface AnswerItemDto {
  id: string;
  questionId: string;
  value: unknown;
}

export interface AnswerDto {
  id: string;
  modelId: string;
  respondentRef: string;
  respondentMeta: Record<string, unknown> | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  tenantId: string;
  items?: AnswerItemDto[];
  createdAt: string;
}
