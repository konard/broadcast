import { describe, test, expect } from 'bun:test';
import { runCli, parsePlatforms } from '../broadcast.mjs';

function mockBroadcaster(name, { configured = true, withCheck = false } = {}) {
  const b = {
    name,
    displayName: name.toUpperCase(),
    sent: [],
    tests: 0,
    checks: 0,
    isConfigured: () => configured,
    getConfigurationErrors: () => (configured ? [] : ['missing']),
    validateMessage: () => ({ isValid: true, errors: [] }),
    async send(message) { b.sent.push(message); return { success: true, platform: name }; },
    async test() { b.tests++; return { success: true, platform: name, message: `${name} live` }; }
  };
  if (withCheck) {
    b.checkConnection = async () => { b.checks++; return { success: true, platform: name, message: `${name} read-only` }; };
  }
  return b;
}

function setup() {
  const bs = [mockBroadcaster('telegram'), mockBroadcaster('vk'), mockBroadcaster('x', { withCheck: true })];
  const lines = [];
  const out = { log: (...a) => lines.push(a.join(' ')), error: (...a) => lines.push(a.join(' ')) };
  const run = (args) => runCli(args, { createBroadcasters: () => bs, out });
  const [telegram, vk, x] = bs;
  return { bs, telegram, vk, x, lines, run };
}

const totalWrites = (bs) => bs.reduce((n, b) => n + b.sent.length + b.tests, 0);

describe('CLI dispatch', () => {
  test('send forwards the complete message unchanged', async () => {
    const { x, telegram, run } = setup();
    const msg = '  Expected payload, with "quotes" & 007  ';
    expect(await run(['send', msg, '--platforms', 'x'])).toBe(0);
    expect(x.sent).toEqual([msg]);
    expect(telegram.sent).toEqual([]);
  });

  test('send does not treat "send" as the payload', async () => {
    const { x, run } = setup();
    await run(['send', 'Expected payload', '-p', 'x']);
    expect(x.sent).toEqual(['Expected payload']);
  });

  test('numeric-looking messages are preserved', async () => {
    const { x, run } = setup();
    await run(['send', '007', '-p', 'x']);
    expect(x.sent).toEqual(['007']);
  });

  test('legacy positional message still works', async () => {
    const { x, run } = setup();
    expect(await run(['Hello', '-p', 'x'])).toBe(0);
    expect(x.sent).toEqual(['Hello']);
  });

  test('dry-run never reaches publishing', async () => {
    for (const args of [
      ['send', 'Expected payload', '--platforms', 'x', '--dry-run'],
      ['send', 'Expected payload', '--platforms', 'telegram,vk', '-d'],
      ['Legacy', '-d']
    ]) {
      const { bs, run, lines } = setup();
      expect(await run(args)).toBe(0);
      expect(totalWrites(bs)).toBe(0);
      expect(lines.some(l => l.includes('Dry run completed'))).toBe(true);
    }
  });

  test('test command dispatches the test handler and does not publish', async () => {
    const { bs, x, run, lines } = setup();
    expect(await run(['test', '--platforms', 'x', '--dry-run'])).toBe(0);
    expect(totalWrites(bs)).toBe(0);
    expect(x.checks).toBe(1);
    expect(lines.some(l => l.includes('Test completed'))).toBe(true);
  });

  test('test command is read-only for providers without checkConnection', async () => {
    const { bs, telegram, run } = setup();
    expect(await run(['test'])).toBe(0);
    expect(totalWrites(bs)).toBe(0);
    expect(telegram.tests).toBe(0);
  });

  test('test --live explicitly opts into provider test helpers', async () => {
    const { telegram, vk, run } = setup();
    expect(await run(['test', '--live', '-p', 'telegram,vk'])).toBe(0);
    expect(telegram.tests).toBe(1);
    expect(vk.tests).toBe(1);
  });

  test('test reports unconfigured providers with non-zero exit', async () => {
    const bs = [mockBroadcaster('telegram', { configured: false })];
    const code = await runCli(['test'], { createBroadcasters: () => bs, out: { log() {}, error() {} } });
    expect(code).toBe(1);
  });

  test('comma-separated platform lists are accepted', async () => {
    const { telegram, vk, x, run } = setup();
    expect(await run(['send', 'Multi', '--platforms', 'telegram, VK'])).toBe(0);
    expect(telegram.sent).toEqual(['Multi']);
    expect(vk.sent).toEqual(['Multi']);
    expect(x.sent).toEqual([]);
  });

  test('unknown platforms are rejected without publishing', async () => {
    const { bs, run, lines } = setup();
    expect(await run(['send', 'Hi', '--platforms', 'telegram,foo'])).toBe(1);
    expect(totalWrites(bs)).toBe(0);
    expect(lines.some(l => l.includes('Invalid platforms: foo'))).toBe(true);
  });

  test('empty platform list is rejected', async () => {
    const { bs, run } = setup();
    expect(await run(['send', 'Hi', '--platforms', ','])).toBe(1);
    expect(totalWrites(bs)).toBe(0);
  });
});

describe('parsePlatforms', () => {
  const bs = [{ name: 'telegram' }, { name: 'vk' }, { name: 'x' }];
  test('splits, trims, lowercases and de-duplicates', () => {
    expect(parsePlatforms(' X,telegram,x ', bs)).toMatchObject({ platforms: ['x', 'telegram'], invalid: [] });
  });
  test('accepts all', () => {
    expect(parsePlatforms('all', bs).invalid).toEqual([]);
  });
});
