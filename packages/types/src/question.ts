export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  FREE_TEXT = 'FREE_TEXT',
  SCALE = 'SCALE',
}

export interface QuestionOption {
  label: string;
  value: string;
  score: number;
}

export interface QuestionDto {
  id: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
  required: boolean;
  order: number;
  axisId: string;
}
