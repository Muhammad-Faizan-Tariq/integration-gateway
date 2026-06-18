import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WebhooksService } from '../webhooks/webhooks.service';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Processor('processing')
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private webhooks: WebhooksService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Processing job ${jobId}`);

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    // Simulate processing time (2–10s)
    await sleep(2000 + Math.random() * 8000);

    // Simulate 20% failure rate
    if (Math.random() < 0.2) {
      throw new Error('Simulated processing failure');
    }

    const dbJob = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: { attachments: true, partner: true },
    });

    // Generate PDF report
    const pdfBytes = await this.generateReport(dbJob);
    const buffer = Buffer.from(pdfBytes);
    const reportStorageKey = await this.storage.uploadPdf(buffer, jobId);

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', reportStorageKey },
    });

    this.logger.log(`Job ${jobId} completed`);
    await this.webhooks.enqueue(jobId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ jobId: string }>, error: Error) {
    const { jobId } = job.data;
    this.logger.error(`Job ${jobId} failed: ${error.message}`);

    // Only mark failed after all BullMQ retries exhausted
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'FAILED' },
      });
    }
  }

  private async generateReport(dbJob: {
    id: string;
    customerId: string;
    caseType: string;
    callbackUrl: string;
    status: string;
    metadata: unknown;
    createdAt: Date;
    partner: { name: string };
    attachments: Array<{ fileName: string; mimeType: string; size: number }>;
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const left = 50;
    const lineH = 22;

    const header = (text: string) => {
      page.drawText(text, { x: left, y, font: boldFont, size: 14, color: rgb(0.1, 0.1, 0.5) });
      y -= lineH * 1.5;
    };

    const field = (label: string, value: string) => {
      page.drawText(`${label}:`, { x: left, y, font: boldFont, size: 11 });
      page.drawText(value, { x: left + 140, y, font, size: 11 });
      y -= lineH;
    };

    header('Integration Gateway — Job Report');
    y -= 10;

    field('Job ID', dbJob.id);
    field('Partner', dbJob.partner.name);
    field('Customer ID', dbJob.customerId);
    field('Case Type', dbJob.caseType);
    field('Status', 'COMPLETED');
    field('Created At', dbJob.createdAt.toISOString());
    field('Generated At', new Date().toISOString());

    y -= lineH;
    header('Attachments');
    if (dbJob.attachments.length === 0) {
      page.drawText('None', { x: left, y, font, size: 11 });
      y -= lineH;
    } else {
      for (const att of dbJob.attachments) {
        const sizeKB = (att.size / 1024).toFixed(1);
        page.drawText(`• ${att.fileName} (${att.mimeType}, ${sizeKB} KB)`, {
          x: left,
          y,
          font,
          size: 11,
        });
        y -= lineH;
      }
    }

    y -= lineH;
    header('Metadata');
    const meta = JSON.stringify(dbJob.metadata ?? {}, null, 2);
    for (const line of meta.split('\n').slice(0, 20)) {
      page.drawText(line, { x: left, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }

    return doc.save();
  }
}
