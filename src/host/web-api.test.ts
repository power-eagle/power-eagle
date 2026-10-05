import { describe, expect, it, vi } from 'vitest';
import { HostCapabilityError } from './capability-error';
import { createEagleWebApi, createWebRequestAdapter } from './web-api';

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({ data }), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('Eagle Web API adapter', () => {
  it('caches the developer token and returns the host history and switch result', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/application/info')) return jsonResponse({ preferences: { developer: { apiToken: 'token + value' } } });
      if (url.includes('/library/history')) return jsonResponse(['C:\\One.library', 'C:\\One.library']);
      expect(url).toBe('http://localhost:41595/api/library/switch?token=token%20%2B%20value');
      expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ libraryPath: 'C:\\Two.library' }) });
      return jsonResponse({ switched: true });
    });
    const api = createEagleWebApi(fetcher);

    await expect(api.library.history()).resolves.toEqual(['C:\\One.library']);
    await expect(api.library.switch('C:\\Two.library')).resolves.toEqual({ switched: true });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/application/info'))).toHaveLength(1);
  });

  it('preserves HTTP and protocol failures as typed errors', async () => {
    const missingToken = createEagleWebApi(async () => jsonResponse({ preferences: { developer: {} } }));
    await expect(missingToken.library.history()).rejects.toMatchObject({
      name: 'HostCapabilityError', capability: 'web-api', operation: 'application.info', code: 'invalid-result',
    });

    const responses = [
      jsonResponse({ preferences: { developer: { apiToken: 'token' } } }),
      new Response('library busy', { status: 503 }),
    ];
    const failed = createEagleWebApi(async () => responses.shift()!);
    await expect(failed.library.switch('C:\\Busy.library')).rejects.toMatchObject({
      name: 'HostCapabilityError', capability: 'web-api', operation: 'library/switch', code: 'failed',
    });

    const errorEnvelope = createEagleWebApi(async input => String(input).endsWith('/application/info')
      ? jsonResponse({ preferences: { developer: { apiToken: 'token' } } })
      : new Response('{"status":"error","message":"switch denied"}', { headers: { 'content-type': 'application/json' } }));
    await expect(errorEnvelope.library.switch('C:\\Denied.library')).rejects.toMatchObject({
      code: 'failed', message: 'switch denied',
    });
  });
});

describe('runtime request adapter', () => {
  it('passes the signal and typed JSON body and returns JSON, text, and empty results', async () => {
    const responses = [
      new Response('{"saved":true}', { headers: { 'content-type': 'application/json' } }),
      new Response('plain text', { headers: { 'content-type': 'text/plain' } }),
      new Response(null, { status: 204 }),
    ];
    const fetcher = vi.fn<typeof fetch>(async () => responses.shift()!);
    const request = createWebRequestAdapter(fetcher);
    const signal = new AbortController().signal;

    await expect(request({ url: 'https://example.test/items', method: 'POST', body: { name: 'Ada' }, signal }))
      .resolves.toEqual({ saved: true });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"name":"Ada"}', signal });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('content-type')).toBe('application/json');
    await expect(request({ url: 'https://example.test/text', method: 'GET', signal })).resolves.toBe('plain text');
    await expect(request({ url: 'https://example.test/empty', method: 'DELETE', signal })).resolves.toBeNull();
  });

  it('does not convert a failed response into a successful value', async () => {
    const request = createWebRequestAdapter(async () => new Response('denied', { status: 403 }));
    await expect(request({ url: 'https://example.test/private', method: 'GET', signal: new AbortController().signal }))
      .rejects.toEqual(expect.objectContaining<Partial<HostCapabilityError>>({
        capability: 'web-api', operation: 'request', code: 'failed',
      }));
  });
});
