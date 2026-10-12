// Small wrapper around fetch. Every failure becomes an Error with a message a person can read,
// plus `status` (0 when the server could not be reached at all).

const UNREACHABLE = 'Cannot reach the server. Is the API running?';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    const err = new Error(UNREACHABLE);
    err.status = 0;
    throw err;
  }

  // A proxy in front of the API (Vite in dev) answers 502-504 when the API itself is down.
  if (res.status >= 502 && res.status <= 504) {
    const err = new Error(UNREACHABLE);
    err.status = res.status;
    throw err;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const listPolls = () => request('/polls');

export const createPoll = (question) =>
  request('/polls', { method: 'POST', body: JSON.stringify({ question }) });

export const vote = (pollId, choice) =>
  request(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ choice }) });
