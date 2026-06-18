import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private publicEndpoint: string;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'integration-gateway');
    this.publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT', 'localhost:9000');

    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: false,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });

    await this.ensureBucket();
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
    }
  }

  async uploadFile(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `uploads/${uuidv4()}-${sanitized}`;
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return storageKey;
  }

  async uploadPdf(buffer: Buffer, jobId: string): Promise<string> {
    const storageKey = `reports/${jobId}-report.pdf`;
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    });
    return storageKey;
  }

  async getPresignedUrl(storageKey: string, expirySeconds = 900): Promise<string> {
    const url = await this.client.presignedGetObject(this.bucket, storageKey, expirySeconds);
    // Rewrite internal Docker hostname to public endpoint for browser access
    return this.rewriteHostname(url);
  }

  private rewriteHostname(url: string): string {
    try {
      const parsed = new URL(url);
      const [publicHost, publicPort] = this.publicEndpoint.split(':');
      parsed.hostname = publicHost;
      if (publicPort) parsed.port = publicPort;
      return parsed.toString();
    } catch {
      return url;
    }
  }
}
