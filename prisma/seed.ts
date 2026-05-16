// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123456', 12)
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
    },
  })
  console.log('✅ Admin user created: admin / admin123456')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
