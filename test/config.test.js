const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

function loadConfig(overrides) {
  return spawnSync(process.execPath, ['-e', "require('./src/config')"], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', DEVICE_API_KEY: 'valid-test-only-key', TRUST_PROXY: 'false', ...overrides },
    encoding: 'utf8',
  });
}

test('production refuses empty and placeholder device API keys', () => {
  for (const key of ['', '   ', 'dev-local-key', 'change-me-to-a-long-random-string']) {
    const result = loadConfig({ DEVICE_API_KEY: key });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DEVICE_API_KEY/);
  }
  assert.equal(loadConfig({}).status, 0);
});

test('proxy configuration accepts scoped trust and rejects trusting every proxy', () => {
  for (const value of ['false', '0', '1', 'loopback,172.18.0.0/16']) {
    assert.equal(loadConfig({ TRUST_PROXY: value }).status, 0, value);
  }
  const result = loadConfig({ TRUST_PROXY: 'true' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TRUST_PROXY/);
});
