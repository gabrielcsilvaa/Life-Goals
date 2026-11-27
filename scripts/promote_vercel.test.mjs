import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promote } from './promote_vercel.mjs';

const env = { VERCEL_TOKEN: 'test-only', VERCEL_PROJECT_ID: 'prj_test', VERCEL_ORG_ID: 'team_test',
  DEPLOYMENT_URL: 'https://tested.vercel.app', FRONTEND_ORIGIN: 'https://production.vercel.app', COMMIT: 'a'.repeat(40) };
function fixture(overrides = {}) {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.includes('/v13/deployments/')) return Response.json({ id: 'dpl_test', projectId: env.VERCEL_PROJECT_ID, readyState: 'READY', target: 'production', ...overrides });
    if (url.includes('/v9/projects/')) return Response.json({ id: env.VERCEL_PROJECT_ID, accountId: env.VERCEL_ORG_ID });
    if (options.method === 'POST') return new Response(null, { status: 200 });
    if (url.endsWith('/version.json')) return Response.json({ commit: env.COMMIT, demoOnly: false });
    throw new Error('Unexpected request');
  };
  return { calls, request };
}
test('promotes the ready project artifact and verifies its public commit', async () => {
  const { calls, request } = fixture(); await promote(env, request);
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  assert.ok(calls.some(c => c.url.includes('/v10/projects/prj_test/promote/dpl_test?teamId=team_test')));
  assert.ok(calls.every(c => !c.url.includes(env.VERCEL_TOKEN)));
});
for (const override of [{ projectId: 'prj_other' }, { readyState: 'ERROR' }, { target: 'preview' }]) {
  test(`rejects unsafe deployment ${JSON.stringify(override)} before promotion`, async () => {
    const { calls, request } = fixture(override); await assert.rejects(promote(env, request));
    assert.equal(calls.filter(c => c.method === 'POST').length, 0);
  });
}
test('fails closed on API denial without disclosing the provider response', async () => {
  await assert.rejects(promote(env, async () => new Response('private provider details', { status: 403 })), e => !e.message.includes('private provider details'));
});
test('rejects an unrelated deployment host without making a request', async () => {
  let called = false;
  await assert.rejects(promote({ ...env, DEPLOYMENT_URL: 'https://example.com' }, async () => { called = true; }));
  assert.equal(called, false);
});
