import { Injectable } from '@nestjs/common';
import { Partner } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateApiKey(rawKey: string): Promise<Partner | null> {
    if (!rawKey || !rawKey.startsWith('sk_')) return null;

    const keyPrefix = rawKey.slice(3, 11);
    const partner = await this.prisma.partner.findUnique({
      where: { keyPrefix },
    });

    if (!partner) return null;

    const valid = await bcrypt.compare(rawKey, partner.apiKeyHash);
    return valid ? partner : null;
  }
}
