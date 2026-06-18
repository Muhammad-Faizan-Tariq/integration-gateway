import { useParams, Link } from 'react-router-dom';
import { useJob, useRetryWebhook, useDownloadUrl } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import type { WebhookDelivery } from '../types/api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, error } = useJob(id!);
  const retry = useRetryWebhook();
  const download = useDownloadUrl();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 mt-8">
        <Spinner /> Loading job...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mt-8">
        <p className="text-red-600">Job not found or access denied.</p>
        <Link to="/jobs" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to Jobs</Link>
      </div>
    );
  }

  const isInFlight = job.status === 'SUBMITTED' || job.status === 'PROCESSING';

  async function handleDownload() {
    const { downloadUrl } = await download.mutateAsync(job!.id);
    window.open(downloadUrl, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/jobs" className="text-sm text-gray-500 hover:text-gray-700">← Jobs</Link>
        <h1 className="text-xl font-bold text-gray-900 font-mono truncate">{job.id}</h1>
        <JobStatusBadge status={job.status} />
        {isInFlight && <Spinner className="h-4 w-4" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Job Details">
          <dl className="space-y-3 text-sm">
            {[
              ['Customer ID', job.customerId],
              ['Case Type', job.caseType],
              ['Callback URL', job.callbackUrl],
              ['Created', formatDate(job.createdAt)],
              ['Updated', formatDate(job.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-gray-500">{label}</dt>
                <dd className="text-gray-900 break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Metadata">
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-48 text-gray-700">
            {JSON.stringify(job.metadata, null, 2)}
          </pre>
        </Card>
      </div>

      <Card title="Attachments">
        {job.attachments.length === 0 ? (
          <p className="text-sm text-gray-500">No attachments.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {job.attachments.map((att) => (
              <li key={att.id} className="py-2 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{att.fileName}</span>
                <span className="text-gray-500">{att.mimeType} · {formatBytes(att.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Actions">
        <div className="flex gap-3 flex-wrap">
          {job.status === 'COMPLETED' && (
            <button
              onClick={handleDownload}
              disabled={download.isPending}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {download.isPending ? 'Getting link…' : 'Download Report'}
            </button>
          )}
          {job.status === 'COMPLETED' && (
            <button
              onClick={() => retry.mutate(job.id)}
              disabled={retry.isPending}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {retry.isPending ? 'Queuing…' : 'Retry Webhook'}
            </button>
          )}
          {retry.isSuccess && (
            <p className="text-sm text-green-600 self-center">Webhook delivery queued.</p>
          )}
        </div>
      </Card>

      {(job.webhookDeliveries?.length ?? 0) > 0 && (
        <Card title="Webhook Delivery History">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                {['Attempt', 'Status', 'HTTP Code', 'Error', 'Time'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {job.webhookDeliveries!.map((d: WebhookDelivery) => (
                <tr key={d.id}>
                  <td className="px-2 py-2">{d.attempt}</td>
                  <td className="px-2 py-2">
                    <span className={`font-medium ${d.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600">{d.responseCode ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-500 max-w-xs truncate">{d.errorMessage ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
