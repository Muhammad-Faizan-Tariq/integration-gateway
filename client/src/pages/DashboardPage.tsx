import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { useJobs, useJobStats } from '../hooks/useJobs';
import { getApiKey } from '../api/client';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { data: jobs } = useJobs();
  const stats = useJobStats(jobs);
  const rawKey = getApiKey();

  const [copied, setCopied] = useState(false);

  const masked = rawKey
    ? `${rawKey.slice(0, 10)}${'•'.repeat(20)}${rawKey.slice(-4)}`
    : '—';

  function copyKey() {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <Card title="API Key">
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono text-gray-700 truncate">
            {masked}
          </code>
          <button
            onClick={copyKey}
            className="shrink-0 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">Include in requests as: X-Api-Key: {masked.slice(0, 12)}...</p>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Jobs" value={stats.total} color="text-gray-900" />
        <StatCard label="Completed" value={stats.completed} color="text-green-600" />
        <StatCard label="Failed" value={stats.failed} color="text-red-600" />
        <StatCard label="In Progress" value={stats.processing} color="text-blue-600" />
      </div>
    </div>
  );
}
