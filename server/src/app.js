import express from 'express';
import { router } from './routes.js';
import { sessionMiddleware } from './session.js';

// Builds the app without starting a server, so tests can call it directly.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', sessionMiddleware, router);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Express recognises an error handler by its four parameters, so `next` must stay.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
