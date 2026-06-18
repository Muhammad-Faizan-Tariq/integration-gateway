import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksProcessor } from './webhooks.processor';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'webhook' })],
  providers: [WebhooksProcessor, WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
