/**
 * Interactive Phase 1 Reel Identification Tester CLI
 * Run with: npm run cli:test-payload
 */

import { ReelIdentifierAdapter } from '../src/adapters/ReelIdentifierAdapter.js';
import { InstagramMessagingEvent } from '../src/types/instagram.js';

interface TestCase {
  name: string;
  description: string;
  event: InstagramMessagingEvent;
}

const testCases: TestCase[] = [
  {
    name: '1. Native Reel Share (ig_reel attachment with tracking parameters)',
    description: 'User taps Share on an Instagram Reel and selects our DM',
    event: {
      sender: { id: 'user_456' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_001_native_reel',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://www.instagram.com/reel/C890_MySampleReel/?igsh=MWx1YnpqamVvMWQx&utm_source=ig_web_copy_link',
              title: 'Ultimate Web Design Checklist 2026',
              video_id: '18109567273171822',
            },
          },
        ],
      },
    },
  },
  {
    name: '2. Native Reel Share with Explicit reel_id',
    description: 'Meta payload provides direct reel_id property',
    event: {
      sender: { id: 'user_789' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_002_explicit_id',
        attachments: [
          {
            type: 'reel',
            payload: {
              reel_id: 'DC5aXYZ89ab',
              title: 'Free Figma UI Kit',
            },
          },
        ],
      },
    },
  },
  {
    name: '3. Lookaside CDN Attachment with Video/Asset ID',
    description: 'Meta passes temporary CDN wrapper URL with asset_id',
    event: {
      sender: { id: 'user_321' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_003_cdn_lookaside',
        attachments: [
          {
            type: 'ig_reel',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=xyz',
              video_id: '18109567273171822',
            },
          },
        ],
      },
    },
  },
  {
    name: '4. Direct Reel Link Pasted in Chat Text',
    description: 'User copied the Reel URL from app and sent it as message text',
    event: {
      sender: { id: 'user_654' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_004_text_link',
        text: 'Hey! Send me the resources for this reel please: https://instagram.com/reel/C-xyz789_AB/?utm_source=copy',
      },
    },
  },
  {
    name: '5. Unsupported Attachment (Direct Image/Photo)',
    description: 'User sent a screenshot or photo instead of a Reel',
    event: {
      sender: { id: 'user_987' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_005_photo',
        attachments: [
          {
            type: 'image',
            payload: {
              url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=9999',
            },
          },
        ],
      },
    },
  },
  {
    name: '6. Conversational Text (No Reel Link)',
    description: 'User asked a general question without sharing a Reel',
    event: {
      sender: { id: 'user_111' },
      recipient: { id: 'page_123' },
      timestamp: Date.now(),
      message: {
        mid: 'mid_006_general_query',
        text: 'Hi, are your courses still available?',
      },
    },
  },
];

console.log('='.repeat(75));
console.log('  REEL TO RESOURCE MATCHER — PHASE 1 REEL IDENTIFICATION TEST RUNNER  ');
console.log('='.repeat(75));
console.log('');

// Check if user passed a custom URL argument
const customUrlArg = process.argv[2];
if (customUrlArg) {
  console.log(`[Custom Test] Testing custom input URL: "${customUrlArg}"`);
  const customEvent: InstagramMessagingEvent = {
    sender: { id: 'user_custom' },
    recipient: { id: 'page_123' },
    timestamp: Date.now(),
    message: {
      mid: 'mid_custom',
      text: customUrlArg,
    },
  };
  const result = ReelIdentifierAdapter.identify(customEvent);
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

// Execute preset test suite
let passedCount = 0;
for (const [index, test] of testCases.entries()) {
  console.log(`\n--- Test Case ${index + 1}: ${test.name} ---`);
  console.log(`Context: ${test.description}`);
  
  const startTime = performance.now();
  const result = ReelIdentifierAdapter.identify(test.event);
  const duration = (performance.now() - startTime).toFixed(3);

  console.log(`> Status:           [${result.status.toUpperCase()}]`);
  console.log(`> Extraction Source: ${result.source}`);
  if (result.reelId) {
    console.log(`> Reel ID:          ${result.reelId}`);
  }
  if (result.canonicalReelUrl) {
    console.log(`> Canonical URL:    ${result.canonicalReelUrl}`);
  }
  if (result.rawUrl) {
    console.log(`> Sanitized URL:    ${result.rawUrl}`);
  }
  if (result.errorReason) {
    console.log(`> Reason / Note:    ${result.errorReason}`);
  }
  console.log(`> Extraction Time:  ${duration} ms`);

  // Verify expectations
  const isExpected = 
    (index <= 3 && result.status === 'identified') ||
    (index === 4 && result.status === 'unsupported_share') ||
    (index === 5 && result.status === 'missing_identifier');

  if (isExpected) {
    console.log('  Result: PASSED (Expected classification)');
    passedCount++;
  } else {
    console.log('  Result: FAILED');
  }
}

console.log('\n' + '='.repeat(75));
console.log(`Phase 1 Test Suite Summary: ${passedCount}/${testCases.length} scenarios verified successfully!`);
console.log('='.repeat(75) + '\n');

