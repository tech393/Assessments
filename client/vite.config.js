import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite forwards /api requests to the Express server.
// The browser then sees one origin, so the session cookie just works and no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
