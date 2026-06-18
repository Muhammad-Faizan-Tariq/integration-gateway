import { Link } from 'react-router-dom';
import { useJobs, useRetryWebhook } from '../hooks/useJobs';
import { JobStatusBadge } from '../components/ui/JobStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import type { Job } from '../types/api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function truncate(str: string, len = 12) {
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

export function JobsListPage() {
  const { data: jobs, isLoading, error } = useJobs();
  const retry = useRetryWebhook();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 mt-8">
        <Spinner /> Loading jobs...
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 mt-8">Failed to load jobs. Check your API key.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <span className="text-xs text-gray-400">Auto-refreshes every 5s</span>
      </div>

      {!jobs?.length ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
          No jobs yet. Use the API Playground to submit one.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Job ID', 'Customer ID', 'Case Type', 'Status', 'Created At', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job: Job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600" title={job.id}>
                    {truncate(job.id, 14)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{job.customerId}</td>
                  <td className="px-4 py-3 text-gray-700">{job.caseType}</td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                      >
                        View
                      </Link>
                      {job.status === 'COMPLETED' && (
                        <button
                          onClick={() => retry.mutate(job.id)}
                          disabled={retry.isPending}
                          className="text-orange-600 hover:text-orange-800 font-medium text-xs disabled:opacity-50"
                        >
                          Retry Webhook
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
