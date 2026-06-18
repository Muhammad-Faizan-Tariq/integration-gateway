import { useState } from 'react';
import { Copy, Check, Key, Briefcase, CheckCircle, XCircle, Clock, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useJobs, useJobStats } from '../hooks/useJobs';
import { getApiKey } from '../api/client';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  pulse?: boolean;
}

function StatCard({ label, value, icon, colorClass, borderClass, pulse }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-5 border-l-4 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold ${colorClass}`}>{value}</p>
        </div>
        <div className={`${colorClass} opacity-15`}>{icon}</div>
      </div>
      {pulse && value > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Processing</span>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data: jobs } = useJobs();
  const stats = useJobStats(jobs);
  const rawKey = getApiKey();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const masked = rawKey
    ? `${rawKey.slice(0, 10)}${'•'.repeat(16)}${rawKey.slice(-4)}`
    : 'No API key configured';

  const displayed = revealed ? rawKey : masked;

  function copyKey() {
    if (!rawKey) return;
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Partner Developer Console</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Submit processing jobs, monitor delivery status, and manage your integration.
        </p>
      </div>

      {/* API Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-400" />
            <CardTitle>API Credentials</CardTitle>
          </div>
          <CardDescription>Your secret API key for authenticating requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 truncate select-all">
              {displayed}
            </code>
            <button
              onClick={() => setRevealed((r) => !r)}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors"
              title={revealed ? 'Hide key' : 'Reveal key'}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <Button variant="outline" size="sm" onClick={copyKey} className="shrink-0 gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Use this key in the{' '}
              <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-mono">X-Api-Key</code>{' '}
              header when calling the public API. Keep it secret — treat it like a password.
            </p>
          </div>

          <div className="mt-3">
            <Badge variant="secondary" className="font-mono text-[10px]">
              X-Api-Key: {rawKey ? rawKey.slice(0, 14) + '...' : '—'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Job Statistics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Jobs"
            value={stats.total}
            icon={<Briefcase className="h-8 w-8" />}
            colorClass="text-slate-700 dark:text-slate-300"
            borderClass="border-l-slate-300 dark:border-l-slate-600"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle className="h-8 w-8" />}
            colorClass="text-emerald-600 dark:text-emerald-400"
            borderClass="border-l-emerald-400 dark:border-l-emerald-600"
          />
          <StatCard
            label="In Progress"
            value={stats.processing}
            icon={<Clock className="h-8 w-8" />}
            colorClass="text-blue-600 dark:text-blue-400"
            borderClass="border-l-blue-400 dark:border-l-blue-600"
            pulse
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={<XCircle className="h-8 w-8" />}
            colorClass="text-red-600 dark:text-red-400"
            borderClass="border-l-red-400 dark:border-l-red-600"
          />
        </div>
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Common actions to get you started.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Submit a Job', desc: 'Test your integration in the API Playground', href: '/playground' },
              { label: 'View All Jobs', desc: 'Monitor status and webhook delivery', href: '/jobs' },
              { label: 'API Reference', desc: 'Full endpoint docs with cURL examples', href: '/docs' },
            ].map(({ label, desc, href }) => (
              <a
                key={href}
                href={href}
                className="group block rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">{desc}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
