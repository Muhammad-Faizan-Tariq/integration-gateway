import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createJob } from '../api/jobs';
import { useJob } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';

function LiveStatus({ jobId }: { jobId: string }) {
  const { data: job } = useJob(jobId);

  if (!job) return <Spinner />;

  const done = job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'WEBHOOK_FAILED';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Status:</span>
        <JobStatusBadge status={job.status} />
        {!done && <Spinner className="h-4 w-4" />}
      </div>
      <p className="text-xs text-gray-500 font-mono">Job ID: {job.id}</p>
    </div>
  );
}

export function PlaygroundPage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [caseType, setCaseType] = useState('KYC');
  const [callbackUrl, setCallbackUrl] = useState('https://httpbin.org/post');
  const [extraMeta, setExtraMeta] = useState('{}');
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let extraObj: Record<string, unknown> = {};
      try {
        extraObj = JSON.parse(extraMeta);
      } catch {
        setError('Extra metadata must be valid JSON');
        return;
      }

      const metadata = JSON.stringify({ customerId, caseType, callbackUrl, ...extraObj });
      const formData = new FormData();
      formData.append('metadata', metadata);

      const files = fileRef.current?.files;
      if (files) {
        Array.from(files).forEach((f) => formData.append('files', f));
      }

      const job = await createJob(formData);
      setSubmittedJobId(job.id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submission failed';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">API Playground</h1>

      <Card title="Submit a Job">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID *</label>
              <input
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="cust-001"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Type *</label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>KYC</option>
                <option>AML</option>
                <option>FRAUD</option>
                <option>ONBOARDING</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Callback URL *</label>
            <input
              required
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachments <span className="text-gray-400">(PDF, JPG, PNG — max 25MB each)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Metadata <span className="text-gray-400">(optional JSON)</span>
            </label>
            <textarea
              value={extraMeta}
              onChange={(e) => setExtraMeta(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isSubmitting && <Spinner className="h-4 w-4 text-white" />}
            {isSubmitting ? 'Submitting…' : 'Submit Job'}
          </button>
        </form>
      </Card>

      {submittedJobId && (
        <Card title="Live Status">
          <LiveStatus jobId={submittedJobId} />
          <p className="mt-3 text-xs text-gray-400">
            Polling every 3s until job reaches a terminal state.
          </p>
        </Card>
      )}
    </div>
  );
}
