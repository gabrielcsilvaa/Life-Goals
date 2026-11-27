// Project-scoped REST promotion avoids the CLI's unrelated team/user lookup.
import { pathToFileURL } from 'node:url';

export async function promote(env, request = fetch) {
  const { VERCEL_TOKEN: token, VERCEL_PROJECT_ID: project, VERCEL_ORG_ID: team,
    DEPLOYMENT_URL: deployment, FRONTEND_ORIGIN: frontend, COMMIT: commit } = env;
  const url = new URL(deployment);
  if (!token || !/^prj_[\w]+$/.test(project) || !/^team_[\w]+$/.test(team)
      || !/^[a-f0-9]{40}$/.test(commit) || url.protocol !== 'https:'
      || !url.hostname.endsWith('.vercel.app') || url.pathname !== '/') {
    throw new Error('Invalid immutable production promotion target.');
  }
  const origin = new URL(frontend);
  if (origin.protocol !== 'https:' || origin.origin !== frontend) {
    throw new Error('Invalid production frontend origin.');
  }
  async function api(path, method = 'GET') {
    const response = await request(`https://api.vercel.com${path}?teamId=${encodeURIComponent(team)}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Vercel project API rejected promotion; response body omitted.');
    return method === 'POST' ? null : response.json();
  }
  const target = await api(`/v13/deployments/${encodeURIComponent(url.hostname)}`);
  if (target.projectId !== project || target.readyState !== 'READY' || target.target !== 'production'
      || !/^dpl_[\w]+$/.test(target.id)) {
    throw new Error('Deployment is not a ready production artifact of the configured project.');
  }
  const owner = await api(`/v9/projects/${encodeURIComponent(project)}`);
  if (owner.id !== project || owner.accountId !== team) throw new Error('Production project owner mismatch.');
  await api(`/v10/projects/${project}/promote/${target.id}`, 'POST');
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await request(`${frontend}/version.json`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const version = await response.json();
      if (version.commit === commit && version.demoOnly === false) return;
    }
    if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Public production version did not match the tested commit.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  promote(process.env).then(() => console.log('Tested production deployment promoted and public version verified.'))
    .catch(() => { console.error('Vercel promotion or public version validation failed; no credentials logged.'); process.exitCode = 1; });
}
