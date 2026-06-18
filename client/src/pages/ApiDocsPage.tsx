import { useState } from 'react';
import { Copy, Check, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';

const BASE_URL = 'http://localhost:3001/v1';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative group">
      <ScrollArea className={`rounded bg-slate-900 p-4 max-h-72 language-${language}`}>
        <pre className="text-xs text-slate-300 font-mono leading-relaxed">{code.trim()}</pre>
      </ScrollArea>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <Badge
      variant={method === 'POST' ? 'success' : 'blue'}
      className="font-mono text-xs font-bold px-2"
    >
      {method}
    </Badge>
  );
}

interface ParamRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

function ParamTable({ params }: { params: ParamRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.map((p) => (
          <TableRow key={p.name}>
            <TableCell>
              <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{p.name}</code>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="font-mono text-[10px]">{p.type}</Badge>
            </TableCell>
            <TableCell>
              {p.required
                ? <Badge variant="destructive" className="text-[10px]">required</Badge>
                : <Badge variant="secondary" className="text-[10px]">optional</Badge>}
            </TableCell>
            <TableCell className="text-xs text-slate-600 dark:text-slate-400">{p.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface EndpointProps {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params?: ParamRow[];
  responseSample: string;
  curlExample: string;
}

function Endpoint({ id, method, path, description, params, responseSample, curlExample }: EndpointProps) {
  return (
    <Card id={id}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MethodBadge method={method} />
          <code className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{path}</code>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="overview">
          <TabsList className="mb-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            {params && params.length > 0 ? (
              <ParamTable params={params} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">No request parameters.</p>
            )}
          </TabsContent>
          <TabsContent value="curl">
            <CodeBlock code={curlExample} language="bash" />
          </TabsContent>
          <TabsContent value="response">
            <CodeBlock code={responseSample} language="json" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function ApiDocsPage() {
  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">API Reference</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Complete endpoint documentation for the Integration Gateway REST API.
        </p>
      </div>

      {/* Base URL */}
      <Card id="base-url">
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
          <CardDescription>All endpoints are relative to this base URL.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block rounded bg-slate-900 px-4 py-2.5 text-sm font-mono text-emerald-400">
            {BASE_URL}
          </code>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Update <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">VITE_API_TARGET</code> to point to a remote backend.
          </p>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card id="auth">
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>All endpoints require an API key passed as a request header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock
            code={`curl ${BASE_URL}/jobs \\\n  -H "X-Api-Key: sk_demo_aabbccddeeff00112233445566778899"`}
          />
          <div className="rounded border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p><strong>Key format:</strong> <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded">sk_</code> prefix followed by 64 hex characters.</p>
            <p><strong>Lookup:</strong> First 8 chars after <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded">sk_</code> are stored as <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded">keyPrefix</code> index — O(1) lookup before bcrypt verify.</p>
            <p><strong>Storage:</strong> Keys stored as bcrypt hashes (cost 10). Plaintext keys are never persisted.</p>
          </div>
        </CardContent>
      </Card>

      {/* Idempotency */}
      <Card id="idempotency">
        <CardHeader>
          <CardTitle>Idempotency</CardTitle>
          <CardDescription>
            Use the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">Idempotency-Key</code> header to safely retry requests without creating duplicate jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock
            code={`# First request — creates the job
curl -X POST ${BASE_URL}/jobs \\
  -H "X-Api-Key: sk_demo_..." \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -F "metadata={...}"

# Identical second request — returns the SAME job, no re-processing
curl -X POST ${BASE_URL}/jobs \\
  -H "X-Api-Key: sk_demo_..." \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -F "metadata={...}"`}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Keys are scoped per partner. The same key used by two partners creates two separate jobs. The playground auto-generates a key per submission.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Endpoints */}
      <div>
        <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Endpoints</h2>
        <div className="space-y-4">

          <Endpoint
            id="post-jobs"
            method="POST"
            path="/v1/jobs"
            description="Submit a new processing job with optional file attachments. Returns HTTP 202 Accepted — processing is asynchronous."
            params={[
              { name: 'metadata', type: 'string (JSON)', required: true, description: 'JSON string containing customerId, caseType, and callbackUrl.' },
              { name: 'customerId', type: 'string', required: true, description: 'Your internal case or customer reference ID.' },
              { name: 'caseType', type: 'string', required: true, description: 'Processing workflow: KYC, AML, FRAUD, or ONBOARDING.' },
              { name: 'callbackUrl', type: 'string (URL)', required: true, description: 'Webhook endpoint that receives completion notification.' },
              { name: 'files', type: 'File[]', required: false, description: 'Attached files (PDF, JPG, PNG). Max 25 MB each, up to 10 files.' },
            ]}
            curlExample={`curl -X POST ${BASE_URL}/jobs \\
  -H "X-Api-Key: sk_demo_..." \\
  -F 'metadata={"customerId":"cust-001","caseType":"KYC","callbackUrl":"https://example.com/hook"}' \\
  -F "files=@document.pdf"`}
            responseSample={`{
  "id": "clxxxxxxxxxxxxx",
  "status": "SUBMITTED",
  "customerId": "cust-001",
  "caseType": "KYC",
  "callbackUrl": "https://example.com/hook",
  "reportStorageKey": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "attachments": [
    { "id": "clzzz...", "fileName": "document.pdf", "mimeType": "application/pdf", "size": 204800 }
  ]
}`}
          />

          <Endpoint
            id="get-jobs"
            method="GET"
            path="/v1/jobs"
            description="List all jobs submitted by your partner account, ordered by creation date descending."
            curlExample={`curl ${BASE_URL}/jobs \\\n  -H "X-Api-Key: sk_demo_..."`}
            responseSample={`[
  {
    "id": "clxxxxxxxxxxxxx",
    "status": "COMPLETED",
    "customerId": "cust-001",
    "caseType": "KYC",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "attachments": []
  }
]`}
          />

          <Endpoint
            id="get-job"
            method="GET"
            path="/v1/jobs/:id"
            description="Retrieve a single job by ID, including all attachments and webhook delivery history."
            params={[
              { name: ':id', type: 'string (cuid)', required: true, description: 'The job ID returned at creation.' },
            ]}
            curlExample={`curl ${BASE_URL}/jobs/clxxxxxxxxxxxxx \\\n  -H "X-Api-Key: sk_demo_..."`}
            responseSample={`{
  "id": "clxxxxxxxxxxxxx",
  "status": "COMPLETED",
  "reportStorageKey": "reports/clxxx-report.pdf",
  "attachments": [...],
  "webhookDeliveries": [
    { "attempt": 1, "status": "SUCCESS", "responseCode": 200, "errorMessage": null }
  ]
}`}
          />

          <Endpoint
            id="download"
            method="GET"
            path="/v1/jobs/:id/download"
            description="Generate a 15-minute presigned download URL for the completed PDF report. Only available when status is COMPLETED."
            params={[
              { name: ':id', type: 'string (cuid)', required: true, description: 'Job ID of a COMPLETED job.' },
            ]}
            curlExample={`curl ${BASE_URL}/jobs/clxxxxxxxxxxxxx/download \\\n  -H "X-Api-Key: sk_demo_..."`}
            responseSample={`{
  "downloadUrl": "http://localhost:9000/integration-gateway/reports/clxxx-report.pdf?X-Amz-Signature=..."
}`}
          />

          <Endpoint
            id="retry-webhook"
            method="POST"
            path="/v1/jobs/:id/retry-webhook"
            description="Re-queue webhook delivery for a COMPLETED job. BullMQ attempts up to 5 times with exponential backoff."
            params={[
              { name: ':id', type: 'string (cuid)', required: true, description: 'Job ID of a COMPLETED job.' },
            ]}
            curlExample={`curl -X POST ${BASE_URL}/jobs/clxxxxxxxxxxxxx/retry-webhook \\\n  -H "X-Api-Key: sk_demo_..."`}
            responseSample={`{ "message": "Webhook delivery queued" }`}
          />
        </div>
      </div>

      <Separator />

      {/* Webhook Signatures */}
      <Card id="webhook-sigs">
        <CardHeader>
          <CardTitle>Webhook Signatures</CardTitle>
          <CardDescription>
            Verify webhook requests originate from Integration Gateway using HMAC-SHA256.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Payload</p>
            <CodeBlock language="json" code={`{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": "clxxxxxxxxxxxxx",
  "status": "COMPLETED",
  "downloadUrl": "http://localhost:9000/..."
}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Verification (Node.js)</p>
            <CodeBlock language="javascript" code={`const crypto = require('crypto');

function verifyWebhook(payload, receivedSignature, webhookSecret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expected)
  );
}

app.post('/webhook', (req, res) => {
  const sig = req.headers['x-signature'];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  res.status(200).send('OK');
});`} />
          </div>
          <div className="rounded border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p><strong>Retry schedule:</strong> Immediate → +60s → +5 min → +15 min → +1 hr</p>
            <p><strong>Max attempts:</strong> 5. After exhaustion, job moves to <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">WEBHOOK_FAILED</code>.</p>
            <p><strong>Success:</strong> Any 2xx response. Non-2xx and network errors trigger a retry.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
