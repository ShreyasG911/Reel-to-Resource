import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import webhookRoutes from './routes/webhookRoutes';
import apiRoutes from './routes/index';
import { RawBodyRequest } from './middleware/verifyMetaSignature';

export function createApp(): Express {
  const app = express();

  // Basic security and CORS headers
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );

  // Capture raw body buffer for HMAC-SHA256 signature verification
  app.use(
    express.json({
      verify: (req: RawBodyRequest, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Health-check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Reel to Resource Matcher API',
    });
  });

  // Mount Meta Instagram Webhook routes
  app.use('/api/v1/webhooks/instagram', webhookRoutes);

  // Mount Dashboard and Management REST API routes
  app.use('/api/v1', apiRoutes);

  // Serve static client bundle if built
  const clientDistPaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ];

  for (const clientDist of clientDistPaths) {
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get('*', (_req, res, next) => {
        if (_req.path.startsWith('/api')) {
          return next();
        }
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      break;
    }
  }

  return app;
}

