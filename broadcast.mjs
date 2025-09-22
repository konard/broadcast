#!/usr/bin/env bun

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { Logger } from './logger.mjs';
import TelegramBroadcaster from './telegram.mjs';
import VKBroadcaster from './vk.mjs';
import XBroadcaster from './x.mjs';

// Load environment variables
dotenv.config();

// Initialize broadcasters
const broadcasters = [
  new TelegramBroadcaster(),
  new VKBroadcaster(),
  new XBroadcaster()
];

// Get broadcaster by name
function getBroadcaster(name) {
  return broadcasters.find(b => b.name === name);
}

// Get all broadcaster names
function getBroadcasterNames() {
  return broadcasters.map(b => b.name);
}

// Main broadcast function
async function broadcast(message, platforms) {
  const logLevel = getenv('LOG_LEVEL', 'info');
  const logger = new Logger(logLevel);
  const results = [];

  // Determine which broadcasters to use
  let targetBroadcasters = [];

  if (platforms.includes('all')) {
    targetBroadcasters = broadcasters;
  } else {
    targetBroadcasters = platforms
      .map(platform => getBroadcaster(platform))
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
    if (!broadcaster.isConfigured()) {
      const errors = broadcaster.getConfigurationErrors();
      validationErrors.push({
        platform: broadcaster.name,
        errors: [`Configuration errors: ${errors.join(', ')}`]
      });
      continue;
    }

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

  logger.debug('Message validation passed for all target platforms');

  // Send to each broadcaster (all validations have already passed)
  for (const broadcaster of targetBroadcasters) {
    try {
      const result = await broadcaster.send(message);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        platform: broadcaster.name,
        error: error.message
      });
    }
  }
  
  return results;
}

// Test function
async function testBroadcasters() {
  const logger = new Logger('debug');
  
  console.log('🔧 Testing configuration...\n');
  
  // Check if .env file exists
  if (existsSync('.env')) {
    console.log('✅ .env file found');
  } else {
    console.log('⚠️  .env file not found, using environment variables');
  }
  
  console.log('\n🧪 Testing connectivity...');
  
  const results = [];
  
  // Test each broadcaster
  for (const broadcaster of broadcasters) {
    if (!broadcaster.isConfigured()) {
      const errors = broadcaster.getConfigurationErrors();
      console.log(`❌ ${broadcaster.displayName}: Configuration errors - ${errors.join(', ')}`);
      results.push({ success: false, platform: broadcaster.name });
    } else {
      try {
        const result = await broadcaster.test();
        if (result.success) {
          console.log(`✅ ${result.message}`);
        } else {
          console.log(`❌ ${result.message}`);
        }
        results.push(result);
      } catch (error) {
        console.log(`❌ ${broadcaster.displayName}: ${error.message}`);
        results.push({ success: false, platform: broadcaster.name });
      }
    }
  }
  
  console.log('\n✨ Test completed!');
  
  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    console.log('\n💡 Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

// CLI setup with yargs
const argv = yargs(hideBin(process.argv))
  .scriptName('broadcast')
  .usage('$0 <message> [options]')
  .version('0.0.1')
  .positional('message', {
    describe: 'Message to broadcast',
    type: 'string'
  })
  .option('platforms', {
    alias: 'p',
    describe: 'Comma-separated list of platforms',
    type: 'string',
    default: 'all',
    choices: [...getBroadcasterNames(), 'all']
  })
  .option('test', {
    alias: 't',
    describe: 'Test mode (do not send, just log)',
    type: 'boolean',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Verbose output',
    type: 'boolean',
    default: false
  })
  .demandCommand(0)
  .help()
  .argv;

(async () => {
  if (argv.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  const message = argv.message || argv._[0];
  if (!message) {
    console.error('❌ Message is required');
    process.exit(1);
  }

  const platforms = argv.platforms.split(',').map(p => p.trim().toLowerCase());
  const validPlatforms = [...getBroadcasterNames(), 'all'];

  // Validate platforms
  const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
  if (invalidPlatforms.length > 0) {
    console.error(`❌ Invalid platforms: ${invalidPlatforms.join(', ')}`);
    console.error(`Valid platforms: ${validPlatforms.join(', ')}`);
    process.exit(1);
  }

  if (argv.test) {
    console.log(`🧪 Test mode: Broadcasting message to: ${platforms.join(', ')}`);
    console.log(`📝 Message: ${message}`);
    console.log('✅ Test completed (no actual send)');
    return;
  }

  try {
    console.log(`🚀 Broadcasting message to: ${platforms.join(', ')}`);
    console.log(`📝 Message: ${message}`);
    console.log('');

    const results = await broadcast(message, platforms);

    console.log('\n📊 Results:');
    results.forEach(({ platform, success, error }) => {
      if (success) {
        console.log(`✅ ${platform.toUpperCase()}: Success`);
      } else {
        console.log(`❌ ${platform.toUpperCase()}: Failed - ${error}`);
      }
    });

    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Broadcast failed:', error.message);
    process.exit(1);
  }
})();