import { randomUUID } from 'node:crypto';

export const SESSION_COOKIE = 'poll_sid';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

// Gives every browser a random session id. The cookie has no Max-Age, so the browser
// drops it when it closes: that is what "one vote per browser session" means here.
export function sessionMiddleware(req, res, next) {
  const existing = readCookie(req.headers.cookie, SESSION_COOKIE);
  // Only accept ids we could have issued; anything else gets a fresh id.
  if (existing && UUID_RE.test(existing)) {
    req.sessionId = existing;
  } else {
    req.sessionId = randomUUID();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${req.sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
  }
  next();
}
