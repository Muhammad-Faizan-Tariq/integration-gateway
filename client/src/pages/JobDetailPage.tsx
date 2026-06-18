import { useParams, Link } from 'react-router-dom';
import {
  ChevronRight, Download, RefreshCw, FileText, Image, File,
  Shield, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useJob, useRetryWebhook, useDownloadUrl } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import type { WebhookDelivery } from '../types/api';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

const BACKOFF_SCHEDULE = ['Immediate', '+60s', '+5 min', '+15 min', '+1 hr'];

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, error } = useJob(id!);
  const retry = useRetryWebhook();
  const download = useDownloadUrl();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-14 w-full rounded" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-44 rounded" />
          <Skeleton className="h-44 rounded" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">Job not found or access denied.</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">This job may belong to a different partner account.</p>
          </div>
        </div>
        <Link to="/jobs" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back to Jobs</Link>
      </div>
    );
  }

  const isInFlight = job.status === 'SUBMITTED' || job.status === 'PROCESSING';

  const statusBannerClass =
    job.status === 'COMPLETED'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
      : job.status === 'FAILED' || job.status === 'WEBHOOK_FAILED'
      ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
      : job.status === 'PROCESSING'
      ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300'
      : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300';

  async function handleDownload() {
    try {
      const { downloadUrl } = await download.mutateAsync(job!.id);
      window.open(downloadUrl, '_blank');
    } catch {
      toast.error('Failed to get download URL');
    }
  }

  function handleRetryWebhook() {
    retry.mutate(job!.id, {
      onSuccess: () => toast.success('Webhook delivery queued'),
      onError: () => toast.error('Failed to queue webhook'),
    });
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/jobs" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Jobs</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">{job.id}</span>
      </div>

      {/* Status banner */}
      <div className={`rounded border px-5 py-3 flex items-center justify-between ${statusBannerClass}`}>
        <div className="flex items-center gap-3">
          <JobStatusBadge status={job.status} />
          {isInFlight && <Spinner className="h-4 w-4" />}
          <span className="text-sm font-medium">
            {job.status === 'COMPLETED' ? 'Job completed successfully'
              : job.status === 'PROCESSING' ? 'Job is being processed…'
              : job.status === 'SUBMITTED' ? 'Job queued for processing'
              : job.status === 'FAILED' ? 'Processing failed'
              : 'Webhook delivery failed'}
          </span>
        </div>
        <span className="text-xs opacity-60">Updated {formatDate(job.updatedAt)}</span>
      </div>

      {/* Details + Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <dl className="space-y-3">
              {([
                ['Job ID', <span key="id" className="font-mono text-xs">{job.id}</span>],
                ['Customer ID', job.customerId],
                ['Case Type', <Badge key="ct" variant="secondary">{job.caseType}</Badge>],
                ['Callback URL', <span key="cb" className="text-xs break-all text-slate-600 dark:text-slate-400">{job.callbackUrl}</span>],
                ['Attachments', `${job.attachments.length} file(s)`],
                ['Created', formatDate(job.createdAt)],
              ] as [string, React.ReactNode][]).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 pt-0.5">{label}</dt>
                  <dd className="text-sm text-slate-900 dark:text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Raw JSON submitted with this job.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-44 rounded bg-slate-900 p-3">
              <pre className="text-xs text-slate-300 font-mono leading-relaxed">
                {JSON.stringify(job.metadata, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>{job.attachments.length} file(s) uploaded with this job.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {job.attachments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No attachments.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {job.attachments.map((att) => (
                <li key={att.id} className="flex items-center gap-3 py-2.5">
                  <FileIcon mimeType={att.mimeType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{att.fileName}</p>
                    <p className="text-xs text-slate-400">{att.mimeType} · {formatBytes(att.size)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-4">
          {job.status === 'COMPLETED' && (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Download Report</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Generates a 15-minute presigned URL for the PDF report stored in MinIO.
                </p>
              </div>
              <Button
                variant="success"
                size="sm"
                onClick={() => void handleDownload()}
                disabled={download.isPending}
                className="shrink-0"
              >
                {download.isPending ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Download className="h-3.5 w-3.5" />}
                {download.isPending ? 'Getting link…' : 'Download PDF'}
              </Button>
            </div>
          )}

          {job.status === 'COMPLETED' && <Separator />}

          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Retry Webhook</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Re-queues webhook delivery. BullMQ attempts up to 5 times:{' '}
                {BACKOFF_SCHEDULE.join(' → ')}.
              </p>
              {job.status !== 'COMPLETED' && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Only available for COMPLETED jobs.</p>
              )}
            </div>
            <Button
              variant="warning"
              size="sm"
              onClick={handleRetryWebhook}
              disabled={retry.isPending || job.status !== 'COMPLETED'}
              className="shrink-0"
            >
              {retry.isPending ? <Spinner className="h-3.5 w-3.5 text-white" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {retry.isPending ? 'Queuing…' : 'Retry Webhook'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Delivery History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            <CardTitle>Webhook Delivery History</CardTitle>
          </div>
          <CardDescription>
            Every attempt is signed with HMAC-SHA256.{' '}
            Verify with:{' '}
            <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs font-mono">
              X-Signature: sha256=&lt;hmac&gt;
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400">Retry schedule:</span>
            {BACKOFF_SCHEDULE.map((step, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] font-mono">{step}</Badge>
                {i < BACKOFF_SCHEDULE.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />}
              </span>
            ))}
          </div>

          {!job.webhookDeliveries?.length ? (
            <div className="flex flex-col items-center py-8 text-center text-slate-400 dark:text-slate-600">
              <Clock className="h-6 w-6 mb-2" />
              <p className="text-sm">No webhook deliveries yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP Code</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.webhookDeliveries.map((d: WebhookDelivery) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">#{d.attempt}</TableCell>
                    <TableCell>
                      {d.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                          <AlertCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.responseCode ? (
                        <Badge
                          variant={d.responseCode >= 200 && d.responseCode < 300 ? 'success' : 'destructive'}
                          className="font-mono text-[10px]"
                        >
                          {d.responseCode}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                      {d.errorMessage ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(d.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
