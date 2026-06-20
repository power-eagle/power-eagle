/**
 * Client for Eagle's local web API (http://localhost:41595). It covers gaps the
 * injected eagle plugin global cannot fill — chiefly switching the active
 * library. The developer token is read once from application/info and passed as
 * a ?token= query param; responses are unwrapped from Eagle's { data } envelope.
 * `fetch` is injected so the client is testable without a live Eagle.
 */

const BASE_URL = 'http://localhost:41595/api';

interface Envelope<T> {
  data: T;
}

interface ApplicationInfo {
  preferences: { developer: { apiToken: string } };
}

/** The Eagle web API surface this app uses (library namespace). */
export interface EagleWebApi {
  library: {
    info(): Promise<unknown>;
    history(): Promise<string[]>;
    switch(libraryPath: string): Promise<void>;
  };
}

/** Build an Eagle web API client over an injectable fetch (token cached per client). */
export function createEagleWebApi(fetcher: typeof fetch = fetch): EagleWebApi {
  let token: string | null = null;

  async function resolveToken(): Promise<string> {
    if (token) return token;
    const response = await fetcher(`${BASE_URL}/application/info`);
    if (!response.ok) {
      throw new Error(`eagle web api unavailable: ${response.status}`);
    }
    const payload = (await response.json()) as Envelope<ApplicationInfo>;
    token = payload.data.preferences.developer.apiToken;
    return token;
  }

  async function request(path: string, method: 'GET' | 'POST', data?: Record<string, unknown>): Promise<unknown> {
    const resolved = await resolveToken();
    const init =
      method === 'POST'
        ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}) }
        : undefined;
    const response = await fetcher(`${BASE_URL}/${path}?token=${resolved}`, init);
    if (!response.ok) {
      throw new Error(`eagle web api ${path} failed: ${response.status}`);
    }
    return ((await response.json()) as Envelope<unknown>).data;
  }

  return {
    library: {
      info: () => request('library/info', 'GET'),
      history: async () => {
        const data = await request('library/history', 'GET');
        return Array.isArray(data) ? data.filter((entry): entry is string => typeof entry === 'string') : [];
      },
      switch: async (libraryPath: string) => {
        await request('library/switch', 'POST', { libraryPath });
      },
    },
  };
}
