/**
 * CLI Tool to Provision or Reset an Administrator Account
 * Usage: npm run admin:create [username] [password]
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../src/models/AdminUser.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reel_to_resource';

async function main() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword123!';

  if (!username || username.length < 3) {
    console.error('Error: Username must be at least 3 characters long.');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long for security.');
    process.exit(1);
  }

  console.log(`[Admin Provisioning] Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);

  const normalizedUsername = username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await AdminUser.findOne({ username: normalizedUsername });

  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`[Admin Provisioning] Successfully updated password for existing admin: "${normalizedUsername}"`);
  } else {
    await AdminUser.create({
      username: normalizedUsername,
      passwordHash,
      role: 'admin',
    });
    console.log(`[Admin Provisioning] Successfully created new administrator: "${normalizedUsername}"`);
  }

  console.log('='.repeat(70));
  console.log('  ADMINISTRATOR CREDENTIALS PROVISIONED  ');
  console.log('='.repeat(70));
  console.log(`  Username: ${normalizedUsername}`);
  console.log('  Role:     admin');
  console.log('  Status:   ACTIVE');
  console.log('='.repeat(70) + '\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Admin Provisioning Error]', err);
  process.exit(1);
});

