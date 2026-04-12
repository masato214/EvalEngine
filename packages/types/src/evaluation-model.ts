import { QuestionDto } from './question';

export interface AxisDto {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  order: number;
  modelId: string;
  questions?: QuestionDto[];
}

export interface EvaluationModelDto {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  projectId: string;
  tenantId: string;
  axes?: AxisDto[];
  createdAt: string;
  updatedAt: string;
}
