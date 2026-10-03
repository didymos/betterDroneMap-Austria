import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowList } from '../server/proxy.mjs';

const allow = parseAllowList('austrocontrol.at, gis.umweltbundesamt.at');

describe('proxy allowlist', () => {
  it('erlaubt Host und Subdomain', () => {
    expect(isAllowed('https://austrocontrol.at/x?y=1', allow)).toBe(true);
    expect(isAllowed('https://sdi.austrocontrol.at/wfs', allow)).toBe(true);
  });
  it('lehnt fremde Hosts, Suffix-Tricks, http, Credentials, Ports, Müll ab', () => {
    expect(isAllowed('https://evilaustrocontrol.at/', allow)).toBe(false);
    expect(isAllowed('https://austrocontrol.at.evil.com/', allow)).toBe(false);
    expect(isAllowed('http://austrocontrol.at/', allow)).toBe(false);
    expect(isAllowed('https://user:pw@austrocontrol.at/', allow)).toBe(false);
    expect(isAllowed('https://austrocontrol.at:8443/', allow)).toBe(false);
    expect(isAllowed('http://169.254.169.254/', allow)).toBe(false);
    expect(isAllowed('nonsense', allow)).toBe(false);
    expect(isAllowed('https://austrocontrol.at/', [])).toBe(false);
  });
});
