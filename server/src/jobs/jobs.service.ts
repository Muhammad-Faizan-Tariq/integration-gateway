import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Partner } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateJobDto } from './dto/create-job.dto';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    @InjectQueue('processing') private processingQueue: Queue,
    @InjectQueue('webhook') private webhookQueue: Queue,
  ) {}

  async create(
    partner: Partner,
    rawMetadata: string,
    files: Express.Multer.File[],
    idempotencyKey?: string,
  ) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { partnerId_key: { partnerId: partner.id, key: idempotencyKey } },
        include: { job: { include: { attachments: true, webhookDeliveries: true } } },
      });
      if (existing) return existing.job;
    }

    // Parse and validate metadata
    let metadataObj: Record<string, unknown>;
    try {
      metadataObj = JSON.parse(rawMetadata);
    } catch {
      throw new BadRequestException({ code: 'INVALID_METADATA', message: 'metadata must be valid JSON' });
    }

    const dto = plainToInstance(CreateJobDto, metadataObj);
    const errors = await validate(dto);
    if (errors.length > 0) {
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: messages.join('; ') });
    }

    // Validate files
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException({
          code: 'INVALID_FILE_TYPE',
          message: `File "${file.originalname}" has unsupported type "${file.mimetype}". Only PDF and image files are allowed.`,
        });
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException({
          code: 'FILE_TOO_LARGE',
          message: `File "${file.originalname}" exceeds the 25MB size limit.`,
        });
      }
    }

    // Upload files to MinIO
    const uploadedFiles = await Promise.all(
      files.map(async (file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: await this.storage.uploadFile(file.buffer, file.mimetype, file.originalname),
      })),
    );

    // Atomic DB transaction
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          partnerId: partner.id,
          customerId: dto.customerId,
          caseType: dto.caseType,
          callbackUrl: dto.callbackUrl,
          metadata: metadataObj as object,
          attachments: {
            create: uploadedFiles,
          },
        },
        include: { attachments: true, webhookDeliveries: true },
      });

      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: { partnerId: partner.id, key: idempotencyKey, jobId: created.id },
        });
      }

      return created;
    });

    await this.processingQueue.add('process-job', { jobId: job.id });

    return job;
  }

  async findAll(partnerId: string) {
    return this.prisma.job.findMany({
      where: { partnerId },
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, partnerId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { attachments: true, webhookDeliveries: { orderBy: { createdAt: 'asc' } } },
    });

    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: `Job ${id} not found` });
    if (job.partnerId !== partnerId) throw new UnauthorizedException({ code: 'ACCESS_DENIED', message: 'Access denied' });

    return job;
  }

  async getDownloadUrl(id: string, partnerId: string): Promise<{ downloadUrl: string }> {
    const job = await this.findOne(id, partnerId);

    if (job.status !== 'COMPLETED' || !job.reportStorageKey) {
      throw new BadRequestException({ code: 'REPORT_NOT_READY', message: 'Report is not available yet' });
    }

    const downloadUrl = await this.storage.getPresignedUrl(job.reportStorageKey, 900);
    return { downloadUrl };
  }

  async retryWebhook(id: string, partnerId: string) {
    const job = await this.findOne(id, partnerId);

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Webhook retry is only available for COMPLETED jobs',
      });
    }

    await this.webhookQueue.add(
      'deliver-webhook',
      { jobId: job.id },
      { attempts: 5, backoff: { type: 'custom' } },
    );

    return { message: 'Webhook delivery queued' };
  }
}
