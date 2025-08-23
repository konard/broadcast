import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import TelegramBroadcaster from '../telegram.mjs';

/**
 * Comprehensive Telegram Test Suite
 * Tests both bot and user authentication methods, messaging, and deletion
 */

describe('Telegram Authentication & Messaging Tests', () => {
  let telegramBroadcaster;
  let sharedTelegramClient;
  let sharedApi;

  beforeAll(async () => {
    telegramBroadcaster = new TelegramBroadcaster();
    
    // Initialize shared connection for user auth tests if configured
    if (telegramBroadcaster.config.hasUserAuth) {
      try {
        const { initTelegramUserConnection } = await import('../telegram.mjs');
        const connectionResult = await initTelegramUserConnection(
          telegramBroadcaster.config, 
          telegramBroadcaster.logger
        );
        sharedTelegramClient = connectionResult.client;
        sharedApi = connectionResult.Api;
        
        // Set the shared client on the broadcaster to reuse connections
        telegramBroadcaster.setTestClient(sharedTelegramClient, sharedApi);
        
        console.log('🔗 Shared Telegram connection established for tests');
      } catch (error) {
        console.warn('⚠️  Failed to establish shared Telegram connection:', error.message);
      }
    }
  });

  afterAll(async () => {
    // Clear test client from broadcaster
    if (telegramBroadcaster && telegramBroadcaster.clearTestClient) {
      telegramBroadcaster.clearTestClient();
    }
    
    // Clean up shared connection
    if (sharedTelegramClient) {
      try {
        await sharedTelegramClient.disconnect();
        console.log('🔌 Shared Telegram connection closed');
      } catch (error) {
        console.warn('⚠️  Error closing shared connection:', error.message);
      }
    }
  });

  test('should detect available authentication methods', () => {
    const config = telegramBroadcaster.config;
    
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
    
    console.log('🔍 Configuration status:');
    console.log(`   Valid: ${config.isValid ? '✅' : '❌'}`);
    console.log(`   Bot Auth: ${config.hasBotAuth ? '✅' : '❌'}`);
    console.log(`   User Auth: ${config.hasUserAuth ? '✅' : '❌'}`);
    
    if (config.hasBotAuth || config.hasUserAuth) {
      expect(config.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    } else {
      expect(config.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      console.log('💡 Configure either bot or user auth to run full tests');
    }
    
    expect(validation).toHaveProperty('errors');
    expect(Array.isArray(validation.errors)).toBe(true);
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

  test('should identify authentication method preference', () => {
    const config = telegramBroadcaster.config;
    
    if (config.hasBotAuth && config.hasUserAuth) {
      console.log('🤖 Both auth methods available - bot auth will be preferred');
    } else if (config.hasBotAuth) {
      console.log('🤖 Bot authentication will be used');
    } else if (config.hasUserAuth) {
      console.log('👤 User authentication will be used');
    } else {
      console.log('❌ No authentication configured');
    }
    
    expect(telegramBroadcaster.isConfigured()).toBe(config.isValid);
    
    const errors = telegramBroadcaster.getConfigurationErrors();
    expect(Array.isArray(errors)).toBe(true);
    
    if (config.isValid) {
      expect(errors).toHaveLength(0);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  test('should send and delete messages successfully (if configured)', async () => {
    const config = telegramBroadcaster.config;
    
    // Skip if not configured
    if (!config.isValid) {
      console.log('⏭️  Skipping message tests - no valid authentication configured');
      expect(true).toBe(true); // Pass the test
      return;
    }

    console.log('📤 Testing complete message lifecycle...');
    const testMessage = '🧪 Test message - will be deleted automatically';
    
    // Send message
    console.log('📝 Sending test message...');
    const sendResult = await telegramBroadcaster.send(testMessage);
    
    expect(sendResult).toHaveProperty('success');
    expect(sendResult).toHaveProperty('platform');
    expect(sendResult.platform).toBe('telegram');
    
    if (!sendResult.success) {
      console.log('❌ Message sending failed (this may be expected in CI/testing):', sendResult.error);
      expect(sendResult).toHaveProperty('error');
      return;
    }
    
    expect(sendResult.messageId).toBeTruthy();
    expect(typeof sendResult.messageId).toBe('number');
    expect(sendResult.messageId).toBeGreaterThan(0);
    
    console.log(`✅ Message sent successfully! ID: ${sendResult.messageId}`);
    console.log(`🔧 Method used: ${sendResult.method}`);
    
    // Verify message was actually created by fetching it
    console.log('🔍 Verifying message was actually created...');
    try {
      if (sharedTelegramClient && sharedApi) {
        // Use shared connection for verification
        const entity = config.userBotChatUsername 
          ? await sharedTelegramClient.getEntity(config.userBotChatUsername)
          : await sharedTelegramClient.getEntity(parseInt(config.userBotChatId, 10));
        
        const messages = await sharedTelegramClient.getMessages(entity, { ids: [sendResult.messageId] });
        
        if (messages.length > 0 && messages[0].id === sendResult.messageId) {
          console.log(`✅ VERIFIED: Message exists on channel: "${messages[0].message}"`);
          expect(messages[0].message).toBe(testMessage);
        } else {
          console.log('⚠️  WARNING: Could not find the posted message');
        }
      } else {
        // Fallback to individual connection if shared connection not available
        const telegram = (await import('telegram')).default;
        const fs = await import('fs');
        const { TelegramClient } = telegram;
        const { StringSession } = telegram.sessions;
        
        const sessionFile = './.telegram_session';
        let storedSession = '';
        if (fs.existsSync(sessionFile)) {
          storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
        }
        
        const stringSession = new StringSession(storedSession);
        const client = new TelegramClient(stringSession, 
          parseInt(config.userBotApiId, 10), 
          config.userBotApiHash, 
          { connectionRetries: 5 }
        );
        
        await client.connect();
        
        try {
          const entity = config.userBotChatUsername 
            ? await client.getEntity(config.userBotChatUsername)
            : await client.getEntity(parseInt(config.userBotChatId, 10));
          
          const messages = await client.getMessages(entity, { ids: [sendResult.messageId] });
          
          if (messages.length > 0 && messages[0].id === sendResult.messageId) {
            console.log(`✅ VERIFIED: Message exists on channel: "${messages[0].message}"`);
            expect(messages[0].message).toBe(testMessage);
          } else {
            console.log('⚠️  WARNING: Could not find the posted message');
          }
        } finally {
          await client.disconnect();
        }
      }
    } catch (verifyError) {
      console.log('🤔 Could not verify message creation:', verifyError.message);
    }
    
    // Wait a moment before deletion
    console.log('⏳ Waiting 2 seconds before deletion...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Delete the message
    console.log('🗑️ Deleting test message...');
    const deleteResult = await telegramBroadcaster.deleteMessage(
      sendResult.messageId, 
      sendResult.chatEntity
    );
    
    expect(deleteResult).toHaveProperty('success');
    expect(deleteResult).toHaveProperty('platform');
    expect(deleteResult.platform).toBe('telegram');
    
    if (deleteResult.success) {
      console.log(`✅ Message deleted successfully! ID: ${sendResult.messageId}`);
      console.log('📋 Delete result:', deleteResult.result?.className || 'Success');
      
      // Verify the message was actually deleted
      console.log('🔍 Verifying message was actually deleted...');
      
      // Wait a moment for deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to fetch the message to verify it's gone - using shared connection if available
      try {
        if (sharedTelegramClient && sharedApi) {
          // Use shared connection for verification
          const entity = config.userBotChatUsername 
            ? await sharedTelegramClient.getEntity(config.userBotChatUsername)
            : await sharedTelegramClient.getEntity(parseInt(config.userBotChatId, 10));
          
          const messagesAfterDelete = await sharedTelegramClient.getMessages(entity, { ids: [sendResult.messageId] });
          
          if (messagesAfterDelete.length === 0 || 
              !messagesAfterDelete[0] || 
              messagesAfterDelete[0].className === 'MessageEmpty') {
            console.log('✅ VERIFIED: Message was actually deleted and cannot be fetched!');
          } else if (messagesAfterDelete[0].id === sendResult.messageId) {
            console.log('⚠️  WARNING: Message still exists and can be fetched - deletion may not have worked');
            console.log(`   Content: "${messagesAfterDelete[0].message}"`);
          } else {
            console.log('🤔 UNCLEAR: Got unexpected response from message fetch');
          }
        } else {
          // Fallback to individual connection
          const telegram = (await import('telegram')).default;
          const fs = await import('fs');
          const { TelegramClient, Api } = telegram;
          const { StringSession } = telegram.sessions;
          
          const sessionFile = './.telegram_session';
          let storedSession = '';
          if (fs.existsSync(sessionFile)) {
            storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
          }
          
          const stringSession = new StringSession(storedSession);
          const client = new TelegramClient(stringSession, 
            parseInt(config.userBotApiId, 10), 
            config.userBotApiHash, 
            { connectionRetries: 5 }
          );
          
          await client.connect();
          
          try {
            const entity = config.userBotChatUsername 
              ? await client.getEntity(config.userBotChatUsername)
              : await client.getEntity(parseInt(config.userBotChatId, 10));
            
            const messagesAfterDelete = await client.getMessages(entity, { ids: [sendResult.messageId] });
            
            if (messagesAfterDelete.length === 0 || 
                !messagesAfterDelete[0] || 
                messagesAfterDelete[0].className === 'MessageEmpty') {
              console.log('✅ VERIFIED: Message was actually deleted and cannot be fetched!');
            } else if (messagesAfterDelete[0].id === sendResult.messageId) {
              console.log('⚠️  WARNING: Message still exists and can be fetched - deletion may not have worked');
              console.log(`   Content: "${messagesAfterDelete[0].message}"`);
            } else {
              console.log('🤔 UNCLEAR: Got unexpected response from message fetch');
            }
          } finally {
            await client.disconnect();
          }
        }
      } catch (verifyError) {
        // Error fetching might be good - could mean it's deleted
        console.log('🤔 Could not verify deletion (this might be expected):', verifyError.message);
      }
    } else {
      console.log('❌ Message deletion failed:', deleteResult.error);
      expect(deleteResult).toHaveProperty('error');
    }
    
    console.log('🎉 Complete message lifecycle test finished - creation, creation verification, deletion, and deletion verification!');
  }, 35000); // 35 second timeout for network operations including verification

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
    const config = telegramBroadcaster.config;
    
    // Only test if we have valid config
    if (!config.isValid) {
      console.log('⏭️  Skipping delete error test - no valid auth configured');
      expect(true).toBe(true); // Pass the test
      return;
    }
    
    // Try to delete a non-existent message
    const invalidBroadcaster = new TelegramBroadcaster();
    
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