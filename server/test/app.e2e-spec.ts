import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { StorageService } from './../src/storage/storage.service';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

// Lightweight stubs — no real DB or MinIO connections
const prismaMock = {
  partner: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), // already seeded → skip create
    create: jest.fn(),
  },
  job: { findMany: jest.fn().mockResolvedValue([]) },
  idempotencyKey: { findUnique: jest.fn().mockResolvedValue(null) },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
};

const storageMock = {
  uploadFile: jest.fn(),
  uploadPdf: jest.fn(),
  getPresignedUrl: jest.fn(),
};

describe('Integration Gateway (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts bootstrap so route paths and error shapes match production
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health check', () => {
    it('GET /health returns 200 with status ok', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('Authentication guard', () => {
    it('GET /v1/jobs without X-Api-Key returns 401 MISSING_API_KEY', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/v1/jobs')
        .expect(401);

      expect(body.code).toBe('MISSING_API_KEY');
    });

    it('GET /v1/jobs with malformed key returns 401 INVALID_API_KEY', async () => {
      prismaMock.partner.findUnique.mockResolvedValueOnce(null);

      const { body } = await request(app.getHttpServer())
        .get('/v1/jobs')
        .set('X-Api-Key', 'not-a-valid-key')
        .expect(401);

      expect(body.code).toBe('INVALID_API_KEY');
    });

    it('POST /v1/jobs without X-Api-Key returns 401 MISSING_API_KEY', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/v1/jobs')
        .expect(401);

      expect(body.code).toBe('MISSING_API_KEY');
    });
  });
});
