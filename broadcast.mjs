#!/usr/bin/env bun

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { existsSync, realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { Logger } from './logger.mjs';
import TelegramBroadcaster from './telegram.mjs';
import VKBroadcaster from './vk.mjs';
import XBroadcaster from './x.mjs';

// Load environment variables
dotenv.config();

// Create the default broadcasters (lazily, so importing this module has no side effects)
export function createDefaultBroadcasters() {
  return [
    new TelegramBroadcaster(),
    new VKBroadcaster(),
    new XBroadcaster()
  ];
}

// Get broadcaster by name
function getBroadcaster(broadcasters, name) {
  return broadcasters.find(b => b.name === name);
}

// Get all broadcaster names
export function getBroadcasterNames(broadcasters) {
  return broadcasters.map(b => b.name);
}

// Main broadcast function
export async function broadcast(message, platforms, broadcasters) {
  const logLevel = getenv('LOG_LEVEL', 'info');
  const logger = new Logger(logLevel);
  const results = [];

  // Determine which broadcasters to use
  let targetBroadcasters = [];

  if (platforms.includes('all')) {
    targetBroadcasters = broadcasters;
  } else {
    targetBroadcasters = platforms
      .map(platform => getBroadcaster(broadcasters, platform))
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

/**
 * Parse and validate a comma-separated platform list.
 * @returns {{platforms: string[], invalid: string[], valid: string[]}}
 */
export function parsePlatforms(value, broadcasters) {
  const valid = [...getBroadcasterNames(broadcasters), 'all'];
  const platforms = [...new Set(String(value ?? 'all')
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0))];
  const invalid = platforms.filter(p => !valid.includes(p));
  if (platforms.length === 0) invalid.push(String(value));
  return { platforms, invalid, valid };
}

/**
 * Configuration and connectivity test.
 * Read-only by default: only broadcasters exposing checkConnection() are contacted.
 * With live=true, provider test() helpers are used, which may publish and delete
 * a test message (Telegram/VK).
 */
export async function testBroadcasters(targetBroadcasters, { live = false, out = console } = {}) {
  out.log('🔧 Testing configuration...\n');

  if (existsSync('.env')) {
    out.log('✅ .env file found');
  } else {
    out.log('⚠️  .env file not found, using environment variables');
  }

  out.log(live ? '\n🧪 Testing connectivity (live: may publish and delete a test message)...' : '\n🧪 Testing connectivity (read-only)...');

  const results = [];

  for (const broadcaster of targetBroadcasters) {
    if (!broadcaster.isConfigured()) {
      const errors = broadcaster.getConfigurationErrors();
      out.log(`❌ ${broadcaster.displayName}: Configuration errors - ${errors.join(', ')}`);
      results.push({ success: false, platform: broadcaster.name });
      continue;
    }
    try {
      let result;
      if (live && typeof broadcaster.test === 'function') {
        result = await broadcaster.test();
      } else if (typeof broadcaster.checkConnection === 'function') {
        result = await broadcaster.checkConnection();
      } else {
        result = {
          success: true,
          platform: broadcaster.name,
          message: `${broadcaster.displayName}: Configuration OK (connectivity check skipped; use --live to publish and delete a test message)`
        };
      }
      out.log(`${result.success ? '✅' : '❌'} ${result.message}`);
      results.push(result);
    } catch (error) {
      out.log(`❌ ${broadcaster.displayName}: ${error.message}`);
      results.push({ success: false, platform: broadcaster.name });
    }
  }

  out.log('\n✨ Test completed!');

  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    out.log('\n💡 Copy .env.example to .env and fill in your credentials.');
  }
  return results;
}

function selectBroadcasters(platforms, broadcasters) {
  if (platforms.includes('all')) return broadcasters;
  return platforms.map(p => getBroadcaster(broadcasters, p)).filter(Boolean);
}

/**
 * Run the CLI.
 * @param {string[]} args - CLI arguments (without node/bun and script path)
 * @param {object} [deps]
 * @param {Function} [deps.createBroadcasters] - factory for broadcasters (mockable)
 * @param {object} [deps.out] - console-like output ({log, error})
 * @returns {Promise<number>} exit code
 */
export async function runCli(args, { createBroadcasters = createDefaultBroadcasters, out = console } = {}) {
  let exitCode = 0;
  let broadcasters = null;
  const getBroadcasters = () => (broadcasters ??= createBroadcasters());

  const resolvePlatforms = (value) => {
    const parsed = parsePlatforms(value, getBroadcasters());
    if (parsed.invalid.length > 0) {
      out.error(`❌ Invalid platforms: ${parsed.invalid.join(', ')}`);
      out.error(`Valid platforms: ${parsed.valid.join(', ')}`);
      exitCode = 1;
      return null;
    }
    return parsed.platforms;
  };

  const sendHandler = async (argv) => {
    if (argv.verbose) process.env.LOG_LEVEL = 'debug';

    const message = argv.message;
    if (typeof message !== 'string' || message.length === 0) {
      out.error('❌ Message is required');
      exitCode = 1;
      return;
    }

    const platforms = resolvePlatforms(argv.platforms);
    if (!platforms) return;

    if (argv.dryRun) {
      out.log(`🧪 Dry run: Broadcasting message to: ${platforms.join(', ')}`);
      out.log(`📝 Message: ${message}`);
      out.log('✅ Dry run completed (no actual send)');
      return;
    }

    try {
      out.log(`🚀 Broadcasting message to: ${platforms.join(', ')}`);
      out.log(`📝 Message: ${message}`);
      out.log('');

      const results = await broadcast(message, platforms, getBroadcasters());

      out.log('\n📊 Results:');
      results.forEach(({ platform, success, error }) => {
        if (success) {
          out.log(`✅ ${platform.toUpperCase()}: Success`);
        } else {
          out.log(`❌ ${platform.toUpperCase()}: Failed - ${error}`);
        }
      });

      if (results.length === 0 || results.some(r => !r.success)) exitCode = 1;
    } catch (error) {
      out.error('❌ Broadcast failed:', error.message);
      exitCode = 1;
    }
  };

  const testHandler = async (argv) => {
    if (argv.verbose) process.env.LOG_LEVEL = 'debug';
    const platforms = resolvePlatforms(argv.platforms);
    if (!platforms) return;
    const results = await testBroadcasters(selectBroadcasters(platforms, getBroadcasters()), { live: argv.live, out });
    if (results.some(r => !r.success)) exitCode = 1;
  };

  const messagePositional = (y) => y.positional('message', {
    describe: 'Message to broadcast (passed unchanged)',
    type: 'string'
  });

  const parser = yargs(args)
    .scriptName('broadcast')
    .version('0.0.2')
    .parserConfiguration({ 'parse-positional-numbers': false })
    .command('send <message>', 'Broadcast a message to specified platforms', messagePositional, sendHandler)
    .command('test', 'Test configuration and read-only connectivity (no messages are published unless --live)', (y) => y
      .option('live', {
        describe: 'Use provider test helpers that publish and delete a test message (Telegram, VK)',
        type: 'boolean',
        default: false
      }), testHandler)
    // Backwards-compatible default: `broadcast "<message>"`
    .command('$0 [message]', 'Broadcast a message (same as `send <message>`)', messagePositional, sendHandler)
    .option('platforms', {
      alias: 'p',
      describe: 'Comma-separated list of platforms (telegram,vk,x,all)',
      type: 'string',
      default: 'all'
    })
    .option('dry-run', {
      alias: 'd',
      describe: 'Dry run mode (do not send, just log)',
      type: 'boolean',
      default: false
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Verbose output',
      type: 'boolean',
      default: false
    })
    .strictCommands()
    .help()
    .exitProcess(false)
    .fail((msg, err) => {
      out.error(`❌ ${msg || err?.message}`);
      exitCode = 1;
    });

  try {
    await parser.parseAsync();
  } catch (error) {
    if (exitCode === 0) {
      out.error(`❌ ${error.message}`);
      exitCode = 1;
    }
  }
  return exitCode;
}

function isMainModule() {
  if (import.meta.main !== undefined) return import.meta.main;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const code = await runCli(hideBin(process.argv));
  process.exit(code);
}
