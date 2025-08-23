#!/usr/bin/env bun

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Config } from './config.mjs';
import { Logger } from './logger.mjs';
import TelegramBroadcaster from './telegram.mjs';
import VKBroadcaster from './vk.mjs';

// Initialize broadcasters
const broadcasters = [
  new TelegramBroadcaster(),
  new VKBroadcaster()
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
  const config = new Config();
  const logger = new Logger(config.logLevel);
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
  
  // Send to each broadcaster
  for (const broadcaster of targetBroadcasters) {
    if (!broadcaster.isConfigured()) {
      const errors = broadcaster.getConfigurationErrors();
      results.push({
        success: false,
        platform: broadcaster.name,
        error: `Configuration errors: ${errors.join(', ')}`
      });
      continue;
    }
    
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
  const config = new Config();
  const logger = new Logger('debug');
  
  console.log('🔧 Testing configuration...\n');
  
  // Check if .env file exists
  if (config.hasEnvFile()) {
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
yargs(hideBin(process.argv))
  .scriptName('broadcast')
  .usage('$0 <cmd> [args]')
  .version('0.0.1')
  .command(
    'send <message>',
    'Send a message to specified platforms',
    (yargs) => {
      yargs
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
        .option('verbose', {
          alias: 'v',
          describe: 'Verbose output',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      if (argv.verbose) {
        process.env.LOG_LEVEL = 'debug';
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
      
      try {
        console.log(`🚀 Broadcasting message to: ${platforms.join(', ')}`);
        console.log(`📝 Message: ${argv.message}`);
        console.log('');
        
        const results = await broadcast(argv.message, platforms);
        
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
    }
  )
  .command(
    'test',
    'Test configuration and connectivity',
    () => {},
    async () => {
      await testBroadcasters();
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .argv;