// Talks only to the worker-only queue API (see server/app.js's
// requireMediaWorker routes). Never touches Postgres or object storage
// through here — those are separate, direct connections (store.mjs, storage.mjs).
export function createApiClient({ baseUrl, token }) {
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'x-sakhatube-worker-token': token };

  return {
    async claim(workerId) {
      const response = await fetch(`${baseUrl}/v1/internal/media-jobs/claim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workerId })
      });
      if (response.status === 204) return null;
      if (!response.ok) throw new Error(`claim вернул ${response.status}`);
      return (await response.json()).job;
    },
    async settle(jobId, payload) {
      const response = await fetch(`${baseUrl}/v1/internal/media-jobs/${jobId}/settle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`settle вернул ${response.status}`);
      return response.json();
    },
    async renew(jobId, leaseToken) {
      const response = await fetch(`${baseUrl}/v1/internal/media-jobs/${jobId}/renew`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leaseToken })
      });
      if (!response.ok) throw new Error(`renew вернул ${response.status}`);
      return (await response.json()).leaseExpiresAt;
    }
  };
}
