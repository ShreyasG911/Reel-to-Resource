import mongoose from 'mongoose';
import { AdminUser } from '../models/AdminUser';
import { AutomationEvent } from '../models/AutomationEvent';
import { IntegrationSetting } from '../models/IntegrationSetting';
import { ReplyLog } from '../models/ReplyLog';
import { Resource } from '../models/Resource';

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/reel_to_resource';

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err: any) {
    console.error(`[Database] Connection error: ${err.message}`);
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function ensureDatabaseIndexes(): Promise<void> {
  await Promise.all([
    AdminUser.init(),
    AutomationEvent.init(),
    IntegrationSetting.init(),
    ReplyLog.init(),
    Resource.init(),
  ]);
  console.log('[Database] All schema indexes ensured.');
}

