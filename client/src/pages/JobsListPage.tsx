import { Link } from 'react-router-dom';
import { Layers, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useJobs, useRetryWebhook } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import type { Job } from '../types/api';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 h-9" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function JobsListPage() {
  const { data: jobs, isLoading, error, refetch } = useJobs();
  const retry = useRetryWebhook();

  function handleRetry(jobId: string) {
    retry.mutate(jobId, {
      onSuccess: () => toast.success('Webhook delivery queued'),
      onError: () => toast.error('Failed to queue webhook'),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-24" />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jobs</h1>
        <div className="flex items-start gap-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">Failed to load jobs</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">Check that your API key is valid and the backend is running.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jobs</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">All processing jobs for your partner account.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="live" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </Badge>
            <Button asChild size="sm">
              <Link to="/playground">Submit Job</Link>
            </Button>
          </div>
        </div>

        {!jobs?.length ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Layers className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No jobs yet</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit your first job using the API Playground.</p>
              <Button asChild size="sm" className="mt-4">
                <Link to="/playground">Go to Playground</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Case Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job: Job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 cursor-default">
                            {job.id.slice(0, 14)}…
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="font-mono">{job.id}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-200">{job.customerId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{job.caseType}</Badge>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </Link>
                        {job.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={retry.isPending}
                            className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {retry.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                            Retry
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-600 text-right">Auto-refreshes every 5 seconds</p>
      </div>
    </TooltipProvider>
  );
}
