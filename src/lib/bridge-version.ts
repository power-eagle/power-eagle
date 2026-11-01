import { lt, parse } from 'semver';

/**
 * Check a bare semantic version against a numeric-major policy.
 * Minor releases within major zero are accepted; metadata does not affect order.
 * Prereleases are accepted if they satisfy the optional minimum. No I/O or coercion.
 */
export function checkBridgeVersion(
  version: string,
  policy: { major: number; minimum?: string },
): 'invalid' | 'major' | 'minimum' | undefined {
  const parsed = /^\d/.test(version) ? parse(version) : null;
  if (!parsed || version.trim() !== version) return 'invalid';
  if (parsed.major !== policy.major) return 'major';
  if (policy.minimum && lt(parsed, policy.minimum)) return 'minimum';
  return undefined;
}
