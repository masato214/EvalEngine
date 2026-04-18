import { PrismaClient, TenantPlan, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TENANT_ID = 'tenant-platform-admin';
const ADMIN_EMAIL = 'admin@evalengine.local';
const ADMIN_PASSWORD = 'EvalEngineAdmin2026!';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {
      name: 'EvalEngine 管理',
      slug: 'evalengine-admin',
      plan: TenantPlan.ENTERPRISE,
      isActive: true,
    },
    create: {
      id: TENANT_ID,
      name: 'EvalEngine 管理',
      slug: 'evalengine-admin',
      plan: TenantPlan.ENTERPRISE,
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email_tenantId: { email: ADMIN_EMAIL, tenantId: tenant.id } },
    update: {
      passwordHash,
      name: 'EvalEngine 管理者',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'EvalEngine 管理者',
      role: UserRole.SUPER_ADMIN,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  console.log('Seeded platform admin');
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`User: ${user.email}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
