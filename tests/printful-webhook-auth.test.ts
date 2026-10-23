import { createHmac, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const sourcePath = new URL('../supabase/functions/printful-webhook/index.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const match = source.match(/async function verifyPrintfulWebhook\([\s\S]*?\n}\n/);
if (!match) throw new Error('Printful webhook verifier was not found in source.');

const transpiled = ts.transpileModule(match[0], {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function verifierFor(envValues: Record<string, string>) {
  return runInNewContext(`${transpiled}; verifyPrintfulWebhook;`, {
    Deno: { env: { get: (key: string) => envValues[key] ?? '' } },
    crypto: webcrypto,
    TextEncoder,
    URL,
  }) as (req: Request, rawBody: string) => Promise<boolean>;
}

const body = JSON.stringify({ type: 'order_shipped', order_id: 'order_test_123' });
const secretBytes = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const secretHex = secretBytes.toString('hex');
const signature = createHmac('sha256', secretBytes).update(body).digest('hex');

function request(url: string, signatureHeader?: string) {
  return new Request(url, {
    method: 'POST',
    headers: signatureHeader ? { 'x-pf-webhook-signature': signatureHeader } : {},
  });
}

describe('Printful webhook authentication', () => {
  it('accepts a valid v2 HMAC over the exact raw body', async () => {
    expect(await verifierFor({ PRINTFUL_WEBHOOK_SIGNING_SECRET: secretHex })(request('https://example.test/webhook', signature), body)).toBe(true);
  });

  it('rejects a modified body with the original signature', async () => {
    expect(await verifierFor({ PRINTFUL_WEBHOOK_SIGNING_SECRET: secretHex })(request('https://example.test/webhook', signature), `${body} `)).toBe(false);
  });

  it('rejects malformed signatures and malformed hexadecimal secrets', async () => {
    expect(await verifierFor({ PRINTFUL_WEBHOOK_SIGNING_SECRET: secretHex })(request('https://example.test/webhook', 'not-a-signature'), body)).toBe(false);
    expect(await verifierFor({ PRINTFUL_WEBHOOK_SIGNING_SECRET: 'xyz' })(request('https://example.test/webhook', signature), body)).toBe(false);
  });

  it('accepts the legacy URL token only when it is high entropy and matches exactly', async () => {
    const token = 'a'.repeat(64);
    const verify = verifierFor({ PRINTFUL_WEBHOOK_SECRET: token });
    expect(await verify(request(`https://example.test/webhook?token=${token}`), body)).toBe(true);
    expect(await verify(request(`https://example.test/webhook?token=${'b'.repeat(64)}`), body)).toBe(false);
  });

  it('rejects a short legacy token and missing authentication configuration', async () => {
    expect(await verifierFor({ PRINTFUL_WEBHOOK_SECRET: 'short' })(request('https://example.test/webhook?token=short'), body)).toBe(false);
    expect(await verifierFor({})(request('https://example.test/webhook'), body)).toBe(false);
  });

  it('keeps authentication gates and the CORS signature header in the source', () => {
    expect(ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS).parseDiagnostics).toHaveLength(0);
    expect(source).toContain("'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pf-webhook-signature'");
    expect(source).toMatch(/if \(!signingSecret && !legacySecret\)[\s\S]*?return json\(\{ error: 'Printful webhook authentication is not configured' \}, 503\)/);
    expect(source).toMatch(/if \(!\(await verifyPrintfulWebhook\(req, rawBody\)\)\)[\s\S]*?return json\(\{ error: 'Invalid Printful webhook authentication' \}, 401\)/);
  });
});
