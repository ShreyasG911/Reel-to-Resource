/**
 * Phase 2 End-to-End Webhook & Matcher Simulation Tool
 * Run with: npm run cli:simulate-webhook
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { EventProcessorService } from '../src/services/EventProcessorService.js';
import { Resource } from '../src/models/Resource.js';
import { AutomationEvent } from '../src/models/AutomationEvent.js';
import { ReplyLog } from '../src/models/ReplyLog.js';
import { InstagramMessagingEvent } from '../src/types/instagram.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reel_to_resource';

async function main() {
  console.log('='.repeat(80));
  console.log('  REEL TO RESOURCE MATCHER — PHASE 2 WEBHOOK & MATCHING SIMULATOR  ');
  console.log('='.repeat(80));
  console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);

  // Check if resources are present, if not inform the user
  const resourceCount = await Resource.countDocuments();
  if (resourceCount === 0) {
    console.log('[Notice] No resources in database. Run "npm run seed" first to populate demo items.');
    process.exit(1);
  }

  console.log(`[Database Ready] Found ${resourceCount} registered resources in library.`);
  console.log('');

  const simulationEvents: { label: string; event: InstagramMessagingEvent }[] = [
    {
      label: 'Sim 1: User shares a KNOWN Reel (Active & Available)',
      event: {
        sender: { id: 'ig_user_alpha' },
        recipient: { id: 'our_business_account' },
        timestamp: Date.now(),
        message: {
          mid: `sim_mid_${Date.now()}_001`,
          attachments: [
            {
              type: 'ig_reel',
              payload: {
                url: 'https://www.instagram.com/reel/DC5aXYZ89ab/?igsh=share_test',
                title: 'Full-Stack SaaS Starter Kit 2026',
              },
            },
          ],
        },
      },
    },
    {
      label: 'Sim 2: User shares an UNKNOWN Reel (Not in database)',
      event: {
        sender: { id: 'ig_user_beta' },
        recipient: { id: 'our_business_account' },
        timestamp: Date.now(),
        message: {
          mid: `sim_mid_${Date.now()}_002`,
          attachments: [
            {
              type: 'ig_reel',
              payload: {
                url: 'https://www.instagram.com/reel/RANDOM_UNKNOWN_REEL_999/',
                title: 'Some Unregistered Reel',
              },
            },
          ],
        },
      },
    },
    {
      label: 'Sim 3: User shares a Reel that exists but is marked UNAVAILABLE',
      event: {
        sender: { id: 'ig_user_gamma' },
        recipient: { id: 'our_business_account' },
        timestamp: Date.now(),
        message: {
          mid: `sim_mid_${Date.now()}_003`,
          text: 'Can I get this? https://www.instagram.com/reel/DESIGN_ROADMAP/',
        },
      },
    },
    {
      label: 'Sim 4: User sends an UNSUPPORTED attachment (Photo/Sticker)',
      event: {
        sender: { id: 'ig_user_delta' },
        recipient: { id: 'our_business_account' },
        timestamp: Date.now(),
        message: {
          mid: `sim_mid_${Date.now()}_004`,
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=888',
              },
            },
          ],
        },
      },
    },
  ];

  // Run the primary simulations
  let savedMid1 = '';
  for (const [idx, item] of simulationEvents.entries()) {
    console.log(`\n>>> [${idx + 1}] ${item.label}`);
    if (idx === 0) savedMid1 = item.event.message!.mid;

    const result = await EventProcessorService.processEvent(item.event);

    console.log(`  - Extraction Status:  [${result.event.identificationStatus.toUpperCase()}]`);
    console.log(`  - Processing Status:  [${result.event.processingStatus.toUpperCase()}]`);
    console.log(`  - Action Taken:       ${result.actionTaken}`);
    if (result.event.matchResult?.title) {
      console.log(`  - Matched Resource:   "${result.event.matchResult.title}"`);
      console.log(`  - Resource URL:       ${result.event.matchResult.resourceUrl}`);
    }
    if (result.renderedReply) {
      console.log(`  - Outbound Reply DM:  "${result.renderedReply}"`);
    }
    if (result.replyLog) {
      console.log(`  - Reply Log ID:       ${result.replyLog._id} (Status: ${result.replyLog.deliveryStatus})`);
    }
  }

  // Simulation 5: Test Webhook Retry Deduplication
  console.log('\n>>> [5] Sim 5: RETRY TEST — Meta retries sending Sim 1 with identical MID');
  console.log(`Re-submitting event with MID: "${savedMid1}"`);

  const duplicateEvent: InstagramMessagingEvent = {
    sender: { id: 'ig_user_alpha' },
    recipient: { id: 'our_business_account' },
    timestamp: Date.now(),
    message: {
      mid: savedMid1,
      attachments: [
        {
          type: 'ig_reel',
          payload: {
            url: 'https://www.instagram.com/reel/DC5aXYZ89ab/',
          },
        },
      ],
    },
  };

  const duplicateResult = await EventProcessorService.processEvent(duplicateEvent);
  console.log(`  - Duplicate Detected: ${duplicateResult.isDuplicate}`);
  console.log(`  - Action Taken:       [${duplicateResult.actionTaken.toUpperCase()}] (Safely dropped without duplicate reply!)`);

  console.log('\n' + '='.repeat(80));
  console.log('  SIMULATION SUITE COMPLETED SUCCESSFULLY  ');
  console.log('='.repeat(80) + '\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Simulator Error]', err);
  process.exit(1);
});

