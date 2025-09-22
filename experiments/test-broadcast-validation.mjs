#!/usr/bin/env bun

import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { Logger } from '../logger.mjs';
import TelegramBroadcaster from '../telegram.mjs';
import VKBroadcaster from '../vk.mjs';
import XBroadcaster from '../x.mjs';

// Load environment variables
dotenv.config();

// Initialize broadcasters
const broadcasters = [
  new TelegramBroadcaster(),
  new VKBroadcaster(),
  new XBroadcaster()
];

// Mock broadcast function (simplified version)
async function testBroadcast(message, platforms) {
  const logLevel = getenv('LOG_LEVEL', 'info');
  const logger = new Logger(logLevel);
  const results = [];

  // Determine which broadcasters to use
  let targetBroadcasters = [];

  if (platforms.includes('all')) {
    targetBroadcasters = broadcasters;
  } else {
    targetBroadcasters = platforms
      .map(platform => broadcasters.find(b => b.name === platform))
      .filter(broadcaster => broadcaster !== undefined);
  }

  if (targetBroadcasters.length === 0) {
    logger.error('No valid broadcasters found for specified platforms');
    return [];
  }

  // Validate message for all target broadcasters first
  logger.debug('Validating message for all target platforms...');
  const validationErrors = [];

  for (const broadcaster of targetBroadcasters) {
    // Mock configuration check (assume all are configured for this test)

    // Check if broadcaster has validateMessage method
    if (typeof broadcaster.validateMessage === 'function') {
      const validation = broadcaster.validateMessage(message);
      if (!validation.isValid) {
        validationErrors.push({
          platform: broadcaster.name,
          errors: validation.errors
        });
      }
    }
  }

  // If any validation failed, return early without sending to any platform
  if (validationErrors.length > 0) {
    logger.error('Message validation failed for one or more platforms:');
    validationErrors.forEach(({ platform, errors }) => {
      errors.forEach(error => {
        logger.error(`  ${platform.toUpperCase()}: ${error}`);
      });
    });

    return validationErrors.map(({ platform, errors }) => ({
      success: false,
      platform,
      error: errors.join(', ')
    }));
  }

  logger.info('Message validation passed for all target platforms');
  logger.info('🚀 Would proceed to send to all platforms');

  // Mock successful results
  return targetBroadcasters.map(broadcaster => ({
    success: true,
    platform: broadcaster.name,
    message: 'Would send successfully'
  }));
}

console.log("🧪 Testing broadcast validation logic...\n");

const shortMessage = "This is a short message";
const longMessage = "a".repeat(300); // 300 characters, should fail X limit

console.log("📋 Test 1: Short message to all platforms");
const result1 = await testBroadcast(shortMessage, ['all']);
console.log("Results:", result1);

console.log("\n📋 Test 2: Long message to all platforms (should fail)");
const result2 = await testBroadcast(longMessage, ['all']);
console.log("Results:", result2);

console.log("\n📋 Test 3: Long message to just VK and Telegram (should pass)");
const result3 = await testBroadcast(longMessage, ['vk', 'telegram']);
console.log("Results:", result3);

console.log("\n✅ Broadcast validation test completed");