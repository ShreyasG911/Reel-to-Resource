import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from './config/database';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectDatabase();
    const app = createApp();

    app.listen(PORT, () => {
      console.log(`[Server] Reel to Resource Matcher running on port ${PORT}`);
      console.log(`[Server] Webhook Endpoint: http://localhost:${PORT}/api/v1/webhooks/instagram`);
      console.log(`[Server] Health Check: http://localhost:${PORT}/health`);
    });
  } catch (err: any) {
    console.error(`[Server] Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();

