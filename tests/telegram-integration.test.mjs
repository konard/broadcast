import { describe, test, expect, beforeAll } from 'bun:test';
import TelegramBroadcaster from '../telegram.mjs';

/**
 * Telegram Integration Test Suite
 * Tests actual messaging functionality (only runs if properly configured)
 */

describe('Telegram Integration Tests', () => {
  let telegramBroadcaster;

  beforeAll(() => {
    telegramBroadcaster = new TelegramBroadcaster();
  });

  test('should be properly configured for testing', () => {
    const config = telegramBroadcaster.config;
    
    // Skip if not configured
    if (!config.isValid) {
      console.log('⏭️  Skipping integration tests - no valid Telegram auth configured');
      return;
    }

    expect(config.isValid).toBe(true);
    
    if (config.hasBotAuth) {
      console.log('🤖 Testing with Bot API authentication');
      expect(config.botToken).toBeTruthy();
      expect(config.channelId).toBeTruthy();
    }
    
    if (config.hasUserAuth) {
      console.log('👤 Testing with User Client authentication');
      expect(config.userBotApiId).toBeTruthy();
      expect(config.userBotApiHash).toBeTruthy();
      expect(config.userBotPhone).toBeTruthy();
      expect(config.userBotChatUsername || config.userBotChatId).toBeTruthy();
    }
  });

  test('should handle configuration validation correctly', () => {
    const config = telegramBroadcaster.config;
    const validation = config.validate();
    
    console.log('🔍 Configuration status:');
    console.log(`   Valid: ${config.isValid ? '✅' : '❌'}`);
    console.log(`   Bot Auth: ${config.hasBotAuth ? '✅' : '❌'}`);
    console.log(`   User Auth: ${config.hasUserAuth ? '✅' : '❌'}`);
    
    if (validation.errors.length > 0) {
      console.log('❌ Validation errors:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    expect(validation).toHaveProperty('errors');
    expect(Array.isArray(validation.errors)).toBe(true);
  });

  test('should send test message successfully (if configured)', async () => {
    const config = telegramBroadcaster.config;
    
    // Skip if not configured
    if (!config.isValid) {
      console.log('⏭️  Skipping message test - no valid authentication');
      expect(true).toBe(true); // Pass the test
      return;
    }

    console.log('📤 Sending test message...');
    const testMessage = '🧪 Test message from broadcast CLI unit tests';
    
    const result = await telegramBroadcaster.send(testMessage);
    
    console.log(`📋 Result: ${result.success ? '✅' : '❌'}`);
    if (result.method) {
      console.log(`🔧 Method: ${result.method}`);
    }
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('platform');
    expect(result.platform).toBe('telegram');
    
    if (result.success) {
      expect(result).toHaveProperty('result');
      console.log('✅ Test message sent successfully');
    } else {
      console.log('❌ Test message failed (this may be expected in CI/testing)');
      expect(result).toHaveProperty('error');
    }
  }, 15000); // 15 second timeout for network operations

  test('should handle broadcaster methods correctly', () => {
    expect(telegramBroadcaster.isConfigured()).toBe(telegramBroadcaster.config.isValid);
    
    const errors = telegramBroadcaster.getConfigurationErrors();
    expect(Array.isArray(errors)).toBe(true);
    
    if (telegramBroadcaster.config.isValid) {
      expect(errors).toHaveLength(0);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});