# Poll App - rules for Claude

Stack: React + Vite (client/), Node + Express + Prisma + PostgreSQL (server/).

Rules:
- Secrets only in .env. .env must be in .gitignore. Keep .env.example updated.
- Only non-secret values may use the VITE_ prefix.
- One vote per poll per browser session, enforced on the server (not only in the UI).
- Validate all API input. Use correct status codes: 201, 400, 404, 409.
- Keep database code separate from route code.
- Every API change needs an automated test.
- Use dev data and dev keys only. Never production.
- Do not add libraries without asking me first.
- Explain each step briefly so I can understand it.
