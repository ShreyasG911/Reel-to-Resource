import mongoose from 'mongoose';

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

