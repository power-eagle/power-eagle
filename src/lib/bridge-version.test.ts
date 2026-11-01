import { describe, expect, it } from 'vitest';
import { checkBridgeVersion } from './bridge-version';

describe('numeric-major compatibility', () => {
  it.each(['0.4.0', '0.4.9', '0.5.0', '0.99.0+build.5', '0.5.0-rc.1'])('accepts %s above a minimum within major zero', version => {
    expect(checkBridgeVersion(version, { major: 0, minimum: '0.4.0' })).toBeUndefined();
  });
  it.each(['2.1.0', '2.90.0-beta.2+metadata', '2.99.99'])('accepts %s within a stable major', version => {
    expect(checkBridgeVersion(version, { major: 2 })).toBeUndefined();
  });
  it.each(['0.3.99', '0.4.0-rc.1'])('rejects %s below the minimum', version => {
    expect(checkBridgeVersion(version, { major: 0, minimum: '0.4.0' })).toBe('minimum');
  });
  it.each(['1.0.0', '1.0.0-rc.1'])('requires review of %s at the next numeric major', version => {
    expect(checkBridgeVersion(version, { major: 0 })).toBe('major');
  });
  it('ignores metadata at the minimum and permits prereleases without a minimum', () => {
    expect(checkBridgeVersion('0.4.0+release', { major: 0, minimum: '0.4.0' })).toBeUndefined();
    expect(checkBridgeVersion('0.1.0-alpha.2', { major: 0 })).toBeUndefined();
    expect(checkBridgeVersion('1.99.0', { major: 2 })).toBe('major');
  });
  it.each(['', 'v0.4.0', '0.4', '00.4.0', '0.4.0.1', '0.4.0 garbage', '0.4.0-01', '0.4.0\n', ' tool 0.4.0'])('rejects malformed version %j', version => {
    expect(checkBridgeVersion(version, { major: 0 })).toBe('invalid');
  });
});
