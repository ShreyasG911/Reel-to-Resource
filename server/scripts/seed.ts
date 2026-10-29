import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Resource } from '../src/models/Resource.js';
import { IntegrationSetting } from '../src/models/IntegrationSetting.js';
import { AdminUser } from '../src/models/AdminUser.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reel_to_resource';

async function seed() {
  console.log(`[Seed] Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);

  console.log('[Seed] Clearing existing demo resources...');
  await Resource.deleteMany({});
  await IntegrationSetting.deleteMany({});

  console.log('[Seed] Inserting sample demonstration resources...');
  const sampleResources = [
    {
      title: 'Full-Stack SaaS Starter Kit 2026',
      description: 'Production-ready Node.js, React, and MongoDB template featuring auth, billing, and team workspaces.',
      reelId: 'DC5aXYZ89ab',
      canonicalReelUrl: 'https://www.instagram.com/reel/DC5aXYZ89ab/',
      resourceUrl: 'https://github.com/example/saas-starter-kit',
      resourceType: 'code',
      tags: ['fullstack', 'react', 'nodejs', 'saas'],
      isAvailable: true,
      status: 'active',
      aliases: ['18109567273171822'],
    },
    {
      title: 'Minimalist Notion Life OS & Task Tracker',
      description: 'Streamlined personal productivity dashboard with PARA organization and weekly reviews.',
      reelId: 'C890_MySampleReel',
      canonicalReelUrl: 'https://www.instagram.com/reel/C890_MySampleReel/',
      resourceUrl: 'https://notion.so/templates/minimalist-life-os',
      resourceType: 'template',
      tags: ['notion', 'productivity', 'system'],
      isAvailable: true,
      status: 'active',
      aliases: ['C890_alias'],
    },
    {
      title: 'Cinematic Mood Lightroom Presets & LUTs',
      description: '10 custom color grading profiles for moody outdoor and portrait photography.',
      reelId: 'LUT_PACK_2026',
      canonicalReelUrl: 'https://www.instagram.com/reel/LUT_PACK_2026/',
      resourceUrl: 'https://gumroad.com/l/cinematic-luts-2026',
      resourceType: 'preset',
      tags: ['presets', 'photography', 'color-grading'],
      isAvailable: true,
      status: 'active',
    },
    {
      title: 'Product Design Career Roadmap (PDF)',
      description: 'Comprehensive step-by-step curriculum for advancing to Senior Product Designer.',
      reelId: 'DESIGN_ROADMAP',
      canonicalReelUrl: 'https://www.instagram.com/reel/DESIGN_ROADMAP/',
      resourceUrl: 'https://example.com/downloads/design-roadmap-2026.pdf',
      resourceType: 'guide',
      tags: ['design', 'career', 'guide'],
      isAvailable: false, // Intentionally unavailable to demonstrate fallback
      status: 'active',
    },
    {
      title: 'AI Prompt Engineering Playbook (Draft)',
      description: 'Advanced reasoning frameworks and few-shot examples for LLMs.',
      reelId: 'AI_PLAYBOOK',
      canonicalReelUrl: 'https://www.instagram.com/reel/AI_PLAYBOOK/',
      resourceUrl: 'https://example.com/draft/ai-playbook',
      resourceType: 'guide',
      tags: ['ai', 'prompts'],
      isAvailable: true,
      status: 'draft', // Draft status
    },
  ];

  await Resource.insertMany(sampleResources);

  console.log('[Seed] Initializing default Integration Settings...');
  await IntegrationSetting.create({
    singletonKey: 'global_settings',
    autoReplyEnabled: true,
    simulationMode: true,
    templates: {
      resourceFound: 'Found it! Here is the resource you requested: {{resourceUrl}}',
      resourceNotFound: "We couldn't find this Reel in our resource library yet. We'll review it and may add the resource later.",
      unsupportedReel: "We couldn't identify this Reel automatically. If possible, please send its direct Reel link.",
      resourceUnavailable: 'This resource is currently undergoing maintenance or is temporarily unavailable. Please check back later!',
    },
    maxRetryAttempts: 3,
    connectedAccount: {
      status: 'unconfigured',
    },
  });

  console.log('[Seed] Provisioning initial Administrator account...');
  await AdminUser.deleteMany({});
  const defaultAdminUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword123!';
  const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);
  await AdminUser.create({
    username: defaultAdminUser,
    passwordHash,
    role: 'admin',
  });

  console.log('\n' + '='.repeat(80));
  console.log('  DATABASE SEED COMPLETED SUCCESSFULLY  ');
  console.log('='.repeat(80));
  console.log('Seeded resources:');
  for (const r of sampleResources) {
    console.log(` - [${r.reelId}] "${r.title}" (Available: ${r.isAvailable}, Status: ${r.status})`);
    console.log(`   URL: ${r.resourceUrl}`);
  }
  console.log('='.repeat(80) + '\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});

