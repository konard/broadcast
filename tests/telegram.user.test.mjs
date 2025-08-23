import { describe, test, expect, beforeAll } from 'bun:test';
import TelegramBroadcaster from '../telegram.mjs';

/**
 * Telegram User Authentication Test Suite
 * Tests both bot and user authentication methods
 */

describe('Telegram User Authentication Tests', () => {
  let telegramBroadcaster;

  beforeAll(() => {
    telegramBroadcaster = new TelegramBroadcaster();
  });

  test('should detect available authentication methods', () => {
    const config = telegramBroadcaster.config;
    
    // At least one auth method should be available for tests to be meaningful
    const hasAnyAuth = config.hasBotAuth || config.hasUserAuth;
    
    // Log the available methods for debugging
    console.log('🔍 Authentication methods detected:');
    console.log(`   Bot Auth: ${config.hasBotAuth ? '✅' : '❌'}`);
    console.log(`   User Auth: ${config.hasUserAuth ? '✅' : '❌'}`);
    
    if (config.hasBotAuth) {
      expect(config.botToken).toBeTruthy();
      expect(config.channelId).toBeTruthy();
    }
    
    if (config.hasUserAuth) {
      expect(config.userBotApiId).toBeTruthy();
      expect(config.userBotApiHash).toBeTruthy();
      expect(config.userBotPhone).toBeTruthy();
      expect(config.userBotChatUsername || config.userBotChatId).toBeTruthy();
    }
  });

  test('should validate configuration correctly', () => {
    const config = telegramBroadcaster.config;
    const validation = config.validate();
    
    if (config.hasBotAuth || config.hasUserAuth) {
      expect(config.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    } else {
      expect(config.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      console.log('💡 Configure either bot or user auth to run full tests');
    }
  });

  test('should handle missing authentication gracefully', () => {
    // Create a broadcaster with no auth configured
    const emptyBroadcaster = new TelegramBroadcaster();
    // Clear all auth data
    emptyBroadcaster.config.botToken = '';
    emptyBroadcaster.config.channelId = '';
    emptyBroadcaster.config.userBotApiId = '';
    emptyBroadcaster.config.userBotApiHash = '';
    emptyBroadcaster.config.userBotPhone = '';
    emptyBroadcaster.config.userBotChatUsername = '';
    emptyBroadcaster.config.userBotChatId = '';
    
    expect(emptyBroadcaster.config.isValid).toBe(false);
    expect(emptyBroadcaster.config.hasBotAuth).toBe(false);
    expect(emptyBroadcaster.config.hasUserAuth).toBe(false);
    
    const errors = emptyBroadcaster.config.validate().errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Either bot authentication');
  });

  test('should identify authentication method preference', async () => {
    const config = telegramBroadcaster.config;
    
    if (config.hasBotAuth && config.hasUserAuth) {
      // When both are available, should prefer bot auth
      const result = await telegramBroadcaster.send('test').catch(err => ({ 
        success: false, 
        error: err.message 
      }));
      
      // The method should be attempted (even if it fails due to invalid credentials)
      expect(result).toBeDefined();
    } else if (config.hasBotAuth) {
      console.log('🤖 Bot authentication will be used');
    } else if (config.hasUserAuth) {
      console.log('👤 User authentication will be used');
    } else {
      console.log('❌ No authentication configured');
    }
  });
});