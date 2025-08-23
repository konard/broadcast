import { describe, test, expect, beforeAll } from 'bun:test';
import TelegramBroadcaster from '../telegram.mjs';

/**
 * Telegram Integration Test Suite
 * Posts a 'test' message, gets the post ID, and deletes it immediately
 */

describe('Telegram Integration Tests', () => {
  let telegramBroadcaster;
  let testMessage;

  beforeAll(() => {
    telegramBroadcaster = new TelegramBroadcaster();
    testMessage = 'test';
  });

  test('should have valid Telegram configuration', () => {
    if (!telegramBroadcaster.config.isValid) {
      const errors = telegramBroadcaster.config.validate().errors;
      console.error('❌ Telegram Configuration Error:');
      errors.forEach(error => console.error(`   - ${error}`));
      console.error('\n💡 Please set either bot or user authentication in your environment or .env file');
    }
    
    expect(telegramBroadcaster.config.isValid).toBe(true);
    expect(telegramBroadcaster.config.hasBotAuth || telegramBroadcaster.config.hasUserAuth).toBe(true);
  });

  test('should have proper authentication method available', () => {
    const config = telegramBroadcaster.config;
    
    if (config.hasBotAuth) {
      expect(config.botToken).toBeTruthy();
      expect(config.channelId).toBeTruthy();
      console.log('🤖 Bot authentication detected');
    }
    
    if (config.hasUserAuth) {
      expect(config.userBotApiId).toBeTruthy();
      expect(config.userBotApiHash).toBeTruthy();
      expect(config.userBotPhone).toBeTruthy();
      expect(config.userBotChatUsername || config.userBotChatId).toBeTruthy();
      console.log('👤 User authentication detected');
    }
  });

  test('should post message, get ID, and delete successfully', async () => {
    // Step 1: Post test message
    console.log('📝 Posting test message...');
    const postResult = await telegramBroadcaster.send(testMessage);
    
    expect(postResult.success).toBe(true);
    expect(postResult.platform).toBe('telegram');
    expect(postResult.messageId).toBeTruthy();
    
    const messageId = postResult.messageId;
    const chatEntity = postResult.chatEntity; // For user auth
    console.log(`✅ Message posted successfully! Message ID: ${messageId}`);
    if (postResult.method) {
      console.log(`🔧 Method used: ${postResult.method}`);
    }
    
    // Step 2: Verify message ID is valid
    expect(typeof messageId).toBe('number');
    expect(messageId).toBeGreaterThan(0);
    
    // Step 3: Wait a moment to ensure message is visible
    console.log('⏳ Waiting 2 seconds before deletion...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Delete the message immediately
    console.log('🗑️  Deleting test message...');
    
    // Create a debug logger temporarily
    const { Logger } = await import('../logger.mjs');
    const originalLogger = telegramBroadcaster.logger;
    telegramBroadcaster.logger = new Logger('debug');
    
    const deleteResult = await telegramBroadcaster.deleteMessage(messageId, chatEntity);
    
    // Restore original logger
    telegramBroadcaster.logger = originalLogger;
    
    console.log(`📋 Delete result:`, deleteResult);
    
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.platform).toBe('telegram');
    console.log(`✅ Message deleted successfully! Message ID: ${messageId}`);
    
    // Step 5: Wait and suggest manual verification
    console.log('💡 Please check your Telegram channel to verify the message was actually deleted.');
  }, 20000); // 20 second timeout for API calls

  test('should handle send errors gracefully', async () => {
    // Create a broadcaster with invalid config to test error handling
    const invalidBroadcaster = new TelegramBroadcaster();
    // Clear all auth data to simulate error
    invalidBroadcaster.config.botToken = '';
    invalidBroadcaster.config.channelId = '';
    invalidBroadcaster.config.userBotApiId = '';
    invalidBroadcaster.config.userBotApiHash = '';
    invalidBroadcaster.config.userBotPhone = '';
    invalidBroadcaster.config.userBotChatUsername = '';
    invalidBroadcaster.config.userBotChatId = '';
    invalidBroadcaster.baseUrl = null;
    
    // Temporarily suppress logger to avoid confusing error messages in test output
    const originalError = invalidBroadcaster.logger.error;
    invalidBroadcaster.logger.error = () => {}; // Suppress error logging for this test
    
    const result = await invalidBroadcaster.send('test');
    
    // Restore original logger
    invalidBroadcaster.logger.error = originalError;
    
    expect(result.success).toBe(false);
    expect(result.platform).toBe('telegram');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('No valid authentication method configured');
  });

  test('should handle delete errors gracefully', async () => {
    // Try to delete a non-existent message
    const invalidBroadcaster = new TelegramBroadcaster();
    
    // Only test if we have valid config
    if (!invalidBroadcaster.config.isValid) {
      console.log('⏭️  Skipping delete error test - no valid auth configured');
      expect(true).toBe(true); // Pass the test
      return;
    }
    
    // Temporarily suppress logger to avoid confusing error messages
    const originalError = invalidBroadcaster.logger.error;
    invalidBroadcaster.logger.error = () => {}; // Suppress error logging for this test
    
    const result = await invalidBroadcaster.deleteMessage(999999999); // Non-existent message ID
    
    // Restore original logger
    invalidBroadcaster.logger.error = originalError;
    
    // Delete might succeed (if message doesn't exist) or fail (if not allowed)
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('platform');
    expect(result.platform).toBe('telegram');
  });
});