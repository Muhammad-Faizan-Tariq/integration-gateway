import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Terminal, Loader2, AlertCircle, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { createJob } from '../api/jobs';
import { useJob } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { Separator } from '../components/ui/separator';

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>
    </div>
  );
}

function LiveStatus({ jobId }: { jobId: string }) {
  const { data: job } = useJob(jobId);
  const [copied, setCopied] = useState(false);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
        <Spinner className="h-4 w-4" /> Loading…
      </div>
    );
  }

  const done = job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'WEBHOOK_FAILED';
  const steps = ['SUBMITTED', 'PROCESSING', 'COMPLETED'] as const;
  const currentStep = steps.indexOf(job.status as (typeof steps)[number]);

  function copyId() {
    navigator.clipboard.writeText(job!.id).then(() => {
      setCopied(true);
      toast.success('Job ID copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
          {job.id}
        </code>
        <button
          onClick={copyId}
          className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <JobStatusBadge status={job.status} />
        {!done && <Spinner className="h-4 w-4" />}
      </div>

      {!done && (
        <div className="flex items-center gap-2">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${i <= currentStep ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <span className={`text-xs ${i <= currentStep ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-400'}`}>
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </span>
              {i < steps.length - 1 && (
                <div className={`h-px w-6 ${i < currentStep ? 'bg-blue-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {done && (
        <div className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border ${
          job.status === 'COMPLETED'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
        }`}>
          {job.status === 'COMPLETED'
            ? <><CheckCircle2 className="h-4 w-4" /> Job completed — report ready.</>
            : <><AlertCircle className="h-4 w-4" /> {job.status.replace('_', ' ')}</>}
        </div>
      )}

      <Link
        to={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        Open full job detail <ExternalLink className="h-3 w-3" />
      </Link>
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
        extraObj = JSON.parse(extraMeta) as Record<string, unknown>;
      } catch {
        setError('Extra metadata must be valid JSON');
        setIsSubmitting(false);
        return;
      }

      const metadata = JSON.stringify({ customerId, caseType, callbackUrl, ...extraObj });
      const formData = new FormData();
      formData.append('metadata', metadata);

      const files = fileRef.current?.files;
      if (files) {
        Array.from(files).forEach((f) => formData.append('files', f));
      }

      // Auto-generate idempotency key per submission
      const idempotencyKey = uuidv4();
      const job = await createJob(formData, { 'Idempotency-Key': idempotencyKey });

      setSubmittedJobId(job.id);
      toast.success('Job submitted successfully');
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const message = errObj?.response?.data?.message ?? 'Submission failed';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
      toast.error('Job submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">API Playground</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Submit a test job and watch it process in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Submit Job</CardTitle>
              <CardDescription>
                Multipart form — files are uploaded to MinIO. An idempotency key is automatically included.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div>
                  <FieldLabel
                    label="Customer ID *"
                    hint="Your internal case or customer reference ID"
                  />
                  <Input
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="cust-001"
                  />
                </div>

                <div>
                  <FieldLabel
                    label="Case Type *"
                    hint="Determines the processing workflow applied to this job"
                  />
                  <Select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
                    <option>KYC</option>
                    <option>AML</option>
                    <option>FRAUD</option>
                    <option>ONBOARDING</option>
                  </Select>
                </div>

                <div>
                  <FieldLabel
                    label="Callback URL *"
                    hint="Receives a POST with HMAC-SHA256 signature on completion"
                  />
                  <Input
                    required
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </div>

                <div>
                  <FieldLabel
                    label="Attachments"
                    hint="PDF, JPG, or PNG — max 25 MB each, up to 10 files"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 transition-colors"
                  />
                </div>

                <div>
                  <FieldLabel
                    label="Extra Metadata"
                    hint="Optional JSON merged into the job metadata object"
                  />
                  <Textarea
                    value={extraMeta}
                    onChange={(e) => setExtraMeta(e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                    placeholder="{}"
                  />
                </div>

                <Separator />

                {error && (
                  <div className="flex items-start gap-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                  ) : (
                    'Submit Job'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live status */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Live Status</CardTitle>
              <CardDescription>
                {submittedJobId ? 'Polling every 3s until terminal state.' : 'Submit a job to see live status.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submittedJobId ? (
                <LiveStatus jobId={submittedJobId} />
              ) : (
                <div className="flex flex-col items-center py-8 text-center text-slate-400 dark:text-slate-600">
                  <Terminal className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No active job</p>
                  <p className="text-xs mt-1">Fill in the form and click Submit.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
