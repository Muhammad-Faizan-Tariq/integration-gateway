import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WebhooksService } from './webhooks.service';

@Processor('webhook', {
  settings: {
    backoffStrategy: (attemptsMade: number) => WebhooksService.getBackoffDelay(attemptsMade),
  },
})
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    const { jobId } = job.data;
    const attempt = job.attemptsMade + 1;
    this.logger.log(`Webhook delivery attempt ${attempt} for job ${jobId}`);

    const dbJob = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: { partner: true },
    });

    let downloadUrl = '';
    if (dbJob.reportStorageKey) {
      downloadUrl = await this.storage.getPresignedUrl(dbJob.reportStorageKey, 900);
    }

    const payload = {
      eventId: uuidv4(),
      jobId: dbJob.id,
      status: dbJob.status,
      downloadUrl,
    };

    const signature = crypto
      .createHmac('sha256', dbJob.partner.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    let responseCode: number | undefined;
    let errorMessage: string | undefined;
    let success = false;

    try {
      const response = await axios.post(dbJob.callbackUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': `sha256=${signature}`,
        },
        timeout: 10_000,
        validateStatus: () => true, // don't throw on non-2xx
      });

      responseCode = response.status;

      if (response.status >= 200 && response.status < 300) {
        success = true;
      } else {
        errorMessage = `HTTP ${response.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await this.prisma.webhookDelivery.create({
      data: {
        jobId,
        attempt,
        status: success ? 'SUCCESS' : 'FAILED',
        responseCode,
        errorMessage,
      },
    });

    if (!success) {
      throw new Error(errorMessage ?? 'Webhook delivery failed');
    }

    this.logger.log(`Webhook delivered successfully for job ${jobId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ jobId: string }>, error: Error) {
    const { jobId } = job.data;
    const maxAttempts = job.opts.attempts ?? 5;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(`All webhook attempts exhausted for job ${jobId}: ${error.message}`);
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'WEBHOOK_FAILED' },
      });
    }
  }
}
