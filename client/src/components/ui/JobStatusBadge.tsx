import type { JobStatus } from '../../types/api';
import { Badge } from './badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'blue' | 'live';

const STATUS_VARIANT: Record<JobStatus, BadgeVariant> = {
  SUBMITTED: 'default',
  PROCESSING: 'blue',
  COMPLETED: 'success',
  FAILED: 'destructive',
  WEBHOOK_FAILED: 'warning',
};

const STATUS_LABEL: Record<JobStatus, string> = {
  SUBMITTED: 'Submitted',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  WEBHOOK_FAILED: 'Webhook Failed',
};

interface Props {
  status: JobStatus;
}

export function JobStatusBadge({ status }: Props) {
  const isInFlight = status === 'SUBMITTED' || status === 'PROCESSING';
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {isInFlight && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
