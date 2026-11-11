import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { XBroadcaster } from '../x.mjs';

const X_VARS = ['X_AUTH_MODE', 'X_OAUTH2_ACCESS_TOKEN', 'X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_API_KEY',
  'X_API_KEY_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'X_BEARER_TOKEN'];

let saved;
beforeEach(() => {
  saved = Object.fromEntries(X_VARS.map(k => [k, process.env[k]]));
  X_VARS.forEach(k => { delete process.env[k]; });
});
afterEach(() => {
  X_VARS.forEach(k => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
});

function create(env, me = async () => ({ data: { username: 'tester' } })) {
  Object.assign(process.env, env);
  const calls = [];
  class MockApi {
    constructor(...args) {
      calls.push(args);
      this.v2 = {
        me,
        tweet: async () => { throw new Error('tweet must not be called in tests'); }
      };
    }
  }
  const x = new XBroadcaster({ ApiClient: MockApi });
  return { x, calls };
}

describe('X.com authentication modes', () => {
  test('OAuth 2.0 user token only (X_ACCESS_TOKEN, no secret) uses bearer string constructor', () => {
    const { x, calls } = create({ X_CLIENT_ID: 'cid', X_CLIENT_SECRET: 'csecret', X_ACCESS_TOKEN: 'oauth2-token' });
    expect(x.isConfigured()).toBe(true);
    expect(x.authMode).toBe('oauth2');
    expect(x.authMethod).toBe('OAuth 2.0 User');
    expect(x.canPost).toBe(true);
    expect(calls).toEqual([['oauth2-token']]);
  });

  test('OAuth 2.0 user token works without client credentials', () => {
    const { x, calls } = create({ X_OAUTH2_ACCESS_TOKEN: 'tok' });
    expect(x.authMode).toBe('oauth2');
    expect(calls).toEqual([['tok']]);
  });

  test('complete OAuth 1.0a uses the four-field constructor', () => {
    const { x, calls } = create({ X_API_KEY: 'k', X_API_KEY_SECRET: 'ks', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
    expect(x.authMode).toBe('oauth1');
    expect(x.authMethod).toBe('OAuth 1.0a User');
    expect(calls).toEqual([[{ appKey: 'k', appSecret: 'ks', accessToken: 't', accessSecret: 'ts' }]]);
  });

  test('incomplete OAuth 1.0a is rejected with missing fields', () => {
    const { x, calls } = create({ X_API_KEY: 'k', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
    expect(x.isConfigured()).toBe(false);
    expect(calls).toEqual([]);
    expect(x.getConfigurationErrors().join()).toContain('X_API_KEY_SECRET');
  });

  test('client ID/secret are never used as OAuth 1.0a app key/secret', () => {
    const { x, calls } = create({ X_CLIENT_ID: 'cid', X_CLIENT_SECRET: 'cs', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
    expect(x.isConfigured()).toBe(false);
    expect(calls).toEqual([]);
    expect(x.getConfigurationErrors().join()).toContain('X_API_KEY');
  });

  test('mixed credentials: complete OAuth 1.0a wins over app bearer and client IDs', () => {
    const { x, calls } = create({ X_CLIENT_ID: 'cid', X_CLIENT_SECRET: 'cs', X_BEARER_TOKEN: 'app',
      X_API_KEY: 'k', X_API_KEY_SECRET: 'ks', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
    expect(x.authMode).toBe('oauth1');
    expect(calls[0][0].appKey).toBe('k');
  });

  test('mixed credentials: OAuth 2.0 user token wins over app bearer', () => {
    const { x, calls } = create({ X_OAUTH2_ACCESS_TOKEN: 'user', X_BEARER_TOKEN: 'app' });
    expect(x.authMode).toBe('oauth2');
    expect(calls).toEqual([['user']]);
  });

  test('explicit X_AUTH_MODE selects the mode', () => {
    const { x, calls } = create({ X_AUTH_MODE: 'oauth2', X_OAUTH2_ACCESS_TOKEN: 'user',
      X_API_KEY: 'k', X_API_KEY_SECRET: 'ks', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
    expect(x.authMode).toBe('oauth2');
    expect(calls).toEqual([['user']]);
  });

  test('explicit X_AUTH_MODE without credentials is an error', () => {
    const { x } = create({ X_AUTH_MODE: 'oauth1', X_OAUTH2_ACCESS_TOKEN: 'user' });
    expect(x.isConfigured()).toBe(false);
    expect(create({ X_AUTH_MODE: 'nope' }).x.getConfigurationErrors().join()).toContain('Invalid X_AUTH_MODE');
  });

  test('app-only bearer token is read-only and cannot post', async () => {
    const { x, calls } = create({ X_BEARER_TOKEN: 'app' });
    expect(x.authMode).toBe('app');
    expect(x.canPost).toBe(false);
    expect(calls).toEqual([['app']]);
    expect(x.validateMessage('hi').isValid).toBe(false);
    const result = await x.send('hi', 1);
    expect(result.success).toBe(false);
    const t = await x.test();
    expect(t.canPost).toBe(false);
  });

  test('connectivity check is read-only and reports identity', async () => {
    const { x } = create({ X_OAUTH2_ACCESS_TOKEN: 'user' });
    const r = await x.checkConnection();
    expect(r.success).toBe(true);
    expect(r.message).toContain('@tester');
  });

  test('identity/permission failures are reported accurately', async () => {
    const err = Object.assign(new Error('Request failed with code 403'), { code: 403 });
    const { x } = create({ X_OAUTH2_ACCESS_TOKEN: 'user' }, async () => { throw err; });
    const r = await x.test();
    expect(r.success).toBe(false);
    expect(r.message).toContain('403 Forbidden');
    const err401 = Object.assign(new Error('401'), { code: 401 });
    const r2 = await create({ X_OAUTH2_ACCESS_TOKEN: 'u' }, async () => { throw err401; }).x.test();
    expect(r2.message).toContain('401 Unauthorized');
  });
});
