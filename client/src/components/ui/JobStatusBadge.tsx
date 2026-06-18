import type { JobStatus } from '../../types/api';

const STATUS_STYLES: Record<JobStatus, string> = {
  SUBMITTED: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  WEBHOOK_FAILED: 'bg-orange-100 text-orange-700',
};

interface Props {
  status: JobStatus;
}

export function JobStatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {(status === 'SUBMITTED' || status === 'PROCESSING') && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status.replace('_', ' ')}
    </span>
  );
}
