import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const BACKOFF_DELAYS = [0, 60_000, 300_000, 900_000, 3_600_000];

@Injectable()
export class WebhooksService {
  constructor(@InjectQueue('webhook') private queue: Queue) {}

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add(
      'deliver-webhook',
      { jobId },
      {
        attempts: 5,
        backoff: { type: 'custom' },
      },
    );
  }

  static getBackoffDelay(attemptsMade: number): number {
    return BACKOFF_DELAYS[attemptsMade] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
  }
}
