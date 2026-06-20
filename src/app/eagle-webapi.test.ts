import { describe, it, expect, vi } from 'vitest';
import { createEagleWebApi } from './eagle-webapi';

function envelope(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => ({ data }) } as unknown as Response;
}

/** Fake Eagle web API: token from application/info, canned data per endpoint. */
function fakeFetch(overrides: { switchOk?: boolean } = {}) {
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input) => {
    const url = String(input);
    if (url.includes('/application/info')) {
      return envelope({ preferences: { developer: { apiToken: 'tok-9' } } });
    }
    if (url.includes('/library/history')) return envelope(['/a/Foo.library', '/b/Bar.library']);
    if (url.includes('/library/info')) return envelope({ name: 'Foo' });
    if (url.includes('/library/switch')) return envelope({}, overrides.switchOk ?? true, overrides.switchOk === false ? 500 : 200);
    return envelope({});
  });
}

describe('createEagleWebApi', () => {
  it('resolves the token once and reuses it across calls', async () => {
    const fetcher = fakeFetch();
    const api = createEagleWebApi(fetcher);
    await api.library.history();
    await api.library.info();
    const tokenCalls = fetcher.mock.calls.filter(([url]) => String(url).includes('/application/info'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('library.switch POSTs the path with the token', async () => {
    const fetcher = fakeFetch();
    await createEagleWebApi(fetcher).library.switch('/lib/Foo.library');
    const call = fetcher.mock.calls.find(([url]) => String(url).includes('/library/switch')) as [string, RequestInit];
    expect(call[0]).toBe('http://localhost:41595/api/library/switch?token=tok-9');
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(String(call[1].body))).toEqual({ libraryPath: '/lib/Foo.library' });
  });

  it('library.history unwraps the data envelope to a string array', async () => {
    const history = await createEagleWebApi(fakeFetch()).library.history();
    expect(history).toEqual(['/a/Foo.library', '/b/Bar.library']);
  });

  it('throws when a request fails', async () => {
    await expect(createEagleWebApi(fakeFetch({ switchOk: false })).library.switch('/x')).rejects.toThrow(
      /library\/switch failed/iu,
    );
  });
});
