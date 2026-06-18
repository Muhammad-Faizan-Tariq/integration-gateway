export type JobStatus = 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'WEBHOOK_FAILED';
export type DeliveryStatus = 'SUCCESS' | 'FAILED';

export interface Attachment {
  id: string;
  jobId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  jobId: string;
  attempt: number;
  status: DeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  partnerId: string;
  customerId: string;
  caseType: string;
  callbackUrl: string;
  status: JobStatus;
  metadata: Record<string, unknown> | null;
  reportStorageKey: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  webhookDeliveries?: WebhookDelivery[];
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}
