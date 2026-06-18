import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const rawKey = process.env.SEED_API_KEY;
  if (!rawKey) {
    console.log('SEED_API_KEY not set — skipping seed');
    return;
  }

  const existing = await prisma.partner.findFirst({ where: { name: 'demo' } });
  if (existing) {
    console.log('Demo partner already exists — skipping seed');
    return;
  }

  const keyPrefix = rawKey.slice(3, 11); // chars after "sk_", first 8
  const apiKeyHash = await bcrypt.hash(rawKey, 10);
  const webhookSecret = require('crypto').randomBytes(32).toString('hex');

  await prisma.partner.create({
    data: { name: 'demo', keyPrefix, apiKeyHash, webhookSecret },
  });

  console.log('✓ Demo partner seeded');
  console.log(`  API Key: ${rawKey}`);
  console.log(`  Webhook Secret: ${webhookSecret}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
