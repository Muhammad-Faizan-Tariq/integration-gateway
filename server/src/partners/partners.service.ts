import { Injectable, Logger } from '@nestjs/common';
import { Partner } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(private prisma: PrismaService) {}

  async create(name: string, rawKey?: string): Promise<{ partner: Partner; rawKey: string }> {
    const key = rawKey ?? `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = key.slice(3, 11);
    const apiKeyHash = await bcrypt.hash(key, 10);
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const partner = await this.prisma.partner.create({
      data: { name, keyPrefix, apiKeyHash, webhookSecret },
    });

    return { partner, rawKey: key };
  }

  async seedDemoPartner(): Promise<void> {
    const rawKey = process.env.SEED_API_KEY;
    if (!rawKey) return;

    const existing = await this.prisma.partner.findFirst({ where: { name: 'demo' } });
    if (existing) return;

    const { rawKey: key, partner } = await this.create('demo', rawKey);
    this.logger.log('Demo partner seeded');
    this.logger.log(`  API Key      : ${key}`);
    this.logger.log(`  Partner ID   : ${partner.id}`);
  }

  async findAll(): Promise<Omit<Partner, 'apiKeyHash'>[]> {
    const partners = await this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return partners.map(({ apiKeyHash: _h, ...rest }) => rest);
  }

  async findOne(id: string): Promise<Omit<Partner, 'apiKeyHash'> | null> {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) return null;
    const { apiKeyHash: _h, ...rest } = partner;
    return rest;
  }
}
