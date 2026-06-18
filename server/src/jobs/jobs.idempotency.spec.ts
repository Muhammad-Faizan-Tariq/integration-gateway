import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Partner } from '@prisma/client';

const mockPartner: Partner = {
  id: 'partner-1',
  name: 'demo',
  keyPrefix: 'aabbccdd',
  apiKeyHash: 'hash',
  webhookSecret: 'secret',
  createdAt: new Date(),
};

const mockJob = {
  id: 'job-abc',
  partnerId: 'partner-1',
  customerId: 'cust-1',
  caseType: 'KYC',
  callbackUrl: 'https://example.com/cb',
  status: 'SUBMITTED' as const,
  metadata: {},
  reportStorageKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  attachments: [],
  webhookDeliveries: [],
};

describe('JobsService — Idempotency', () => {
  let service: JobsService;
  let prisma: jest.Mocked<Partial<PrismaService>>;
  let processingQueue: { add: jest.Mock };

  const validMetadata = JSON.stringify({
    customerId: 'cust-1',
    caseType: 'KYC',
    callbackUrl: 'https://example.com/cb',
  });

  beforeEach(async () => {
    processingQueue = { add: jest.fn().mockResolvedValue(undefined) };

    prisma = {
      idempotencyKey: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      } as any,
      job: {
        create: jest.fn().mockResolvedValue(mockJob),
      } as any,
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) =>
        fn({
          job: { create: jest.fn().mockResolvedValue(mockJob) },
          idempotencyKey: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: StorageService,
          useValue: { uploadFile: jest.fn().mockResolvedValue('uploads/test-key') },
        },
        { provide: getQueueToken('processing'), useValue: processingQueue },
        { provide: getQueueToken('webhook'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('creates a new job on first request', async () => {
    (prisma.idempotencyKey!.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await service.create(mockPartner, validMetadata, [], 'key-1');

    expect(result.id).toBe('job-abc');
    expect(prisma.idempotencyKey!.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partnerId_key: { partnerId: 'partner-1', key: 'key-1' } } }),
    );
  });

  it('returns existing job on duplicate idempotency key without creating new', async () => {
    const existingKey = {
      job: { ...mockJob, id: 'existing-job' },
    };
    (prisma.idempotencyKey!.findUnique as jest.Mock).mockResolvedValue(existingKey);

    const result1 = await service.create(mockPartner, validMetadata, [], 'key-dup');
    const result2 = await service.create(mockPartner, validMetadata, [], 'key-dup');

    expect(result1.id).toBe('existing-job');
    expect(result2.id).toBe('existing-job');

    // Transaction (which creates a new job) should NOT have been called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates separate jobs for different idempotency keys', async () => {
    (prisma.idempotencyKey!.findUnique as jest.Mock).mockResolvedValue(null);

    const result1 = await service.create(mockPartner, validMetadata, [], 'key-a');
    const result2 = await service.create(mockPartner, validMetadata, [], 'key-b');

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid file types', async () => {
    (prisma.idempotencyKey!.findUnique as jest.Mock).mockResolvedValue(null);

    const badFile = {
      originalname: 'doc.txt',
      mimetype: 'text/plain',
      size: 1024,
      buffer: Buffer.from('hello'),
    } as Express.Multer.File;

    await expect(service.create(mockPartner, validMetadata, [badFile])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects files exceeding 25MB', async () => {
    (prisma.idempotencyKey!.findUnique as jest.Mock).mockResolvedValue(null);

    const bigFile = {
      originalname: 'large.pdf',
      mimetype: 'application/pdf',
      size: 26 * 1024 * 1024,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    await expect(service.create(mockPartner, validMetadata, [bigFile])).rejects.toThrow(
      BadRequestException,
    );
  });
});
