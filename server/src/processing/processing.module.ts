import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingProcessor } from './processing.processor';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'processing' }),
    WebhooksModule,
  ],
  providers: [ProcessingProcessor],
})
export class ProcessingModule {}
