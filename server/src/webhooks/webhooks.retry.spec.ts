import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { WebhooksProcessor } from './webhooks.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockJob = {
  id: 'job-1',
  partnerId: 'partner-1',
  customerId: 'cust-1',
  caseType: 'KYC',
  callbackUrl: 'https://example.com/webhook',
  status: 'COMPLETED',
  metadata: {},
  reportStorageKey: 'reports/job-1-report.pdf',
  createdAt: new Date(),
  updatedAt: new Date(),
  partner: {
    id: 'partner-1',
    name: 'demo',
    keyPrefix: 'aabbccdd',
    apiKeyHash: 'hash',
    webhookSecret: 'supersecret',
    createdAt: new Date(),
  },
};

function makeBullJob(attemptsMade = 0, maxAttempts = 5) {
  return {
    data: { jobId: 'job-1' },
    attemptsMade,
    opts: { attempts: maxAttempts },
  } as any;
}

describe('WebhooksProcessor — Retry Logic', () => {
  let processor: WebhooksProcessor;
  let prisma: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    prisma = {
      job: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockJob),
        update: jest.fn().mockResolvedValue(mockJob),
      } as any,
      webhookDelivery: {
        create: jest.fn().mockResolvedValue({}),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksProcessor,
        { provide: PrismaService, useValue: prisma },
        {
          provide: StorageService,
          useValue: { getPresignedUrl: jest.fn().mockResolvedValue('https://localhost:9000/presigned') },
        },
      ],
    }).compile();

    processor = module.get<WebhooksProcessor>(WebhooksProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it('records SUCCESS delivery and does not throw on 200 response', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

    await expect(processor.process(makeBullJob(0))).resolves.not.toThrow();

    expect(prisma.webhookDelivery!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS', responseCode: 200 }),
      }),
    );
    expect(prisma.job!.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'WEBHOOK_FAILED' } }),
    );
  });

  it('records FAILED delivery and throws on non-2xx response', async () => {
    mockedAxios.post.mockResolvedValue({ status: 500, data: {} });

    await expect(processor.process(makeBullJob(0))).rejects.toThrow('HTTP 500');

    expect(prisma.webhookDelivery!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', responseCode: 500 }),
      }),
    );
  });

  it('marks job as WEBHOOK_FAILED after all attempts exhausted', async () => {
    mockedAxios.post.mockResolvedValue({ status: 500, data: {} });
    const job = makeBullJob(5, 5); // attemptsMade === maxAttempts

    await processor.onFailed(job, new Error('HTTP 500'));

    expect(prisma.job!.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'WEBHOOK_FAILED' },
    });
  });

  it('does not mark WEBHOOK_FAILED before all attempts exhausted', async () => {
    const job = makeBullJob(2, 5); // Still has retries left
    await processor.onFailed(job, new Error('HTTP 500'));

    expect(prisma.job!.update).not.toHaveBeenCalled();
  });

  it('records network error message in delivery', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(processor.process(makeBullJob(0))).rejects.toThrow('ECONNREFUSED');

    expect(prisma.webhookDelivery!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'ECONNREFUSED' }),
      }),
    );
  });
});
