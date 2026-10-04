export type FixtureLocation = 'repository' | 'standalone';

export interface PathResolver {
  dirname(path: string): string;
  resolve(...paths: string[]): string;
}

export function pluginRootFromEagleUrl(href: string, mode: FixtureLocation, path: PathResolver): string | undefined {
  const page = new URL(href);
  if (page.protocol !== 'eagleplugin:') return undefined;
  const decoded = decodeURIComponent(page.pathname);
  const documentPath = decoded.replace(/^\/+([A-Za-z]:\/)/, '$1');
  if (!/^[A-Za-z]:\//.test(documentPath)) return undefined;
  const pageDirectory = path.dirname(documentPath);
  return path.resolve(pageDirectory, mode === 'standalone' ? '.' : '..');
}
