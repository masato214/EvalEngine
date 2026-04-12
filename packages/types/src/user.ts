export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
}

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  tenantId: string;
  createdAt: string;
}
