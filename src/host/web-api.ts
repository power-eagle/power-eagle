import type { Json } from '../sdui/schema/model';
import type { RequestInput } from '../sdui/runtime/actions';
import { HostCapabilityError, hostOperation } from './capability-error';

const EAGLE_WEB_API_V1 = 'http://localhost:41595/api';

interface WebResponse<T> {
  data: T;
  status?: 'success' | 'error';
  message?: string;
}

interface EagleApplicationInfo {
  preferences?: { developer?: { apiToken?: string } };
}

export interface EagleWebApi {
  library: {
    history(signal?: AbortSignal): Promise<string[]>;
    switch(path: string, signal?: AbortSignal): Promise<unknown>;
  };
}

async function responseDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.trim() ? `: ${body.trim().slice(0, 240)}` : '';
  } catch {
    return '';
  }
}

async function readEnvelope<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) {
    throw new HostCapabilityError(
      'web-api', operation, 'failed',
      `Eagle Web API ${operation} returned HTTP ${response.status}${await responseDetail(response)}`,
    );
  }
  let payload: WebResponse<T>;
  try {
    payload = await response.json() as WebResponse<T>;
  } catch (error) {
    throw new HostCapabilityError('web-api', operation, 'invalid-result', `Eagle Web API ${operation} returned invalid JSON`, { cause: error });
  }
  if (payload?.status === 'error') {
    throw new HostCapabilityError('web-api', operation, 'failed', payload.message || `Eagle Web API ${operation} failed`);
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new HostCapabilityError('web-api', operation, 'invalid-result', `Eagle Web API ${operation} returned no data envelope`);
  }
  return payload.data;
}

/** Client for the retained v1 history/switch operations absent from the plugin API. */
export function createEagleWebApi(fetcher: typeof fetch = fetch, baseUrl = EAGLE_WEB_API_V1): EagleWebApi {
  let token: string | undefined;

  async function resolveToken(signal?: AbortSignal): Promise<string> {
    if (token) return token;
    const info = await hostOperation('web-api', 'application.info', async () =>
      readEnvelope<EagleApplicationInfo>(await fetcher(`${baseUrl}/application/info`, { signal }), 'application.info'));
    const candidate = info.preferences?.developer?.apiToken;
    if (!candidate) {
      throw new HostCapabilityError('web-api', 'application.info', 'invalid-result', 'Eagle Web API did not provide a developer token');
    }
    token = candidate;
    return candidate;
  }

  async function request<T>(operation: string, method: 'GET' | 'POST', body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    return hostOperation('web-api', operation, async () => {
      const resolvedToken = await resolveToken(signal);
      const url = `${baseUrl}/${operation}?token=${encodeURIComponent(resolvedToken)}`;
      const response = await fetcher(url, {
        method,
        signal,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}),
      });
      return readEnvelope<T>(response, operation);
    });
  }

  return {
    library: {
      history: async signal => {
        const history = await request<unknown>('library/history', 'GET', undefined, signal);
        if (!Array.isArray(history) || history.some(path => typeof path !== 'string')) {
          throw new HostCapabilityError('library', 'history', 'invalid-result', 'Eagle library history was not a string array');
        }
        return [...new Set(history)];
      },
      switch: (path, signal) => request('library/switch', 'POST', { libraryPath: path }, signal),
    },
  };
}

function isJsonContent(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

/** Runtime request adapter that preserves response failures and JSON value types. */
export function createWebRequestAdapter(fetcher: typeof fetch = fetch): (input: RequestInput) => Promise<Json> {
  return input => hostOperation('web-api', 'request', async () => {
    const headers = new Headers(input.headers);
    let body: string | undefined;
    if (input.body !== undefined) {
      body = JSON.stringify(input.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
    const response = await fetcher(input.url, { method: input.method, headers, body, signal: input.signal });
    if (!response.ok) {
      throw new HostCapabilityError(
        'web-api', 'request', 'failed',
        `Request ${input.method} ${input.url} returned HTTP ${response.status}${await responseDetail(response)}`,
      );
    }
    if (response.status === 204) return null;
    if (!isJsonContent(response)) return response.text();
    try {
      return await response.json() as Json;
    } catch (error) {
      throw new HostCapabilityError('web-api', 'request', 'invalid-result', `Request ${input.method} ${input.url} returned invalid JSON`, { cause: error });
    }
  });
}
