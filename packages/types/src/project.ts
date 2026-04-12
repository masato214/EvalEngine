export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
