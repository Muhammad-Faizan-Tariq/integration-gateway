import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Body,
  Headers,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Partner } from '@prisma/client';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentPartner } from '../common/decorators/partner.decorator';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 26_214_400 },
    }),
  )
  create(
    @CurrentPartner() partner: Partner,
    @Body('metadata') metadata: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.jobsService.create(partner, metadata ?? '{}', files ?? [], idempotencyKey);
  }

  @Get()
  findAll(@CurrentPartner() partner: Partner) {
    return this.jobsService.findAll(partner.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentPartner() partner: Partner) {
    return this.jobsService.findOne(id, partner.id);
  }

  @Get(':id/download')
  getDownloadUrl(@Param('id') id: string, @CurrentPartner() partner: Partner) {
    return this.jobsService.getDownloadUrl(id, partner.id);
  }

  @Post(':id/retry-webhook')
  retryWebhook(@Param('id') id: string, @CurrentPartner() partner: Partner) {
    return this.jobsService.retryWebhook(id, partner.id);
  }
}
