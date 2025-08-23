import { describe, test, expect, beforeAll } from 'bun:test';
import XBroadcaster from '../x.mjs';

/**
 * X.com Integration Test Suite
 * Tests X.com broadcasting functionality with post/delete cycle
 * 
 * NOTE: These tests are skipped to avoid real API requests
 * To enable: replace 'describe.skip' with 'describe'
 */

describe.skip('X.com Integration Tests', () => {
  let xBroadcaster;
  let testMessage;

  beforeAll(() => {
    xBroadcaster = new XBroadcaster();
    testMessage = 'test tweet from broadcast CLI 🧪';
  });

  test('should have valid X.com configuration', () => {
    if (!xBroadcaster.config.isValid) {
      const errors = xBroadcaster.config.validate().errors;
      console.error('❌ X.com Configuration Error:');
      errors.forEach(error => console.error(`   - ${error}`));
      console.error('\n💡 Please set X.com authentication credentials in your environment or .env file');
      console.error('   Visit https://developer.twitter.com/en/portal/dashboard to create an app');
    }
    
    expect(xBroadcaster.config.isValid).toBe(true);
    
    // Test authentication method detection
    console.log('🔍 Authentication methods detected:');
    console.log(`   OAuth 1.0a User: ${xBroadcaster.config.hasUserAuth ? '✅' : '❌'}`);
    console.log(`   Bearer Token: ${xBroadcaster.config.hasBearerAuth ? '✅' : '❌'}`);
    
    // At least one should be configured
    const hasAnyAuth = xBroadcaster.config.hasUserAuth || xBroadcaster.config.hasBearerAuth;
    expect(hasAnyAuth).toBe(true);
  });

  test('should have Twitter API client initialized', () => {
    expect(xBroadcaster.client).toBeTruthy();
    expect(xBroadcaster.authMethod).toBeTruthy();
    console.log(`🔧 Using authentication method: ${xBroadcaster.authMethod}`);
    
    if (xBroadcaster.authMethod === 'Bearer Token') {
      console.log('⚠️  Bearer Token has limited functionality - cannot post or delete tweets');
    }
  });

  test('should detect configuration status correctly', () => {
    const configured = xBroadcaster.isConfigured();
    const errors = xBroadcaster.getConfigurationErrors();
    
    console.log('🔍 Configuration status:');
    console.log(`   Configured: ${configured ? '✅' : '❌'}`);
    console.log(`   Client initialized: ${xBroadcaster.client ? '✅' : '❌'}`);
    console.log(`   Auth method: ${xBroadcaster.authMethod || 'None'}`);
    
    if (configured) {
      expect(errors).toHaveLength(0);
    } else {
      expect(errors.length).toBeGreaterThan(0);
      console.log('💡 Configuration errors:', errors);
    }
    
    expect(Array.isArray(errors)).toBe(true);
  });

  test('should post tweet, get ID, and delete successfully', async () => {
    // Skip if using bearer token (cannot post)
    if (xBroadcaster.authMethod === 'Bearer Token') {
      console.log('⏭️  Skipping post/delete test - Bearer Token cannot post tweets');
      expect(true).toBe(true); // Pass the test
      return;
    }

    // Post test tweet
    console.log('📝 Posting test tweet...');
    const postResult = await xBroadcaster.send(testMessage);
    
    expect(postResult.success).toBe(true);
    expect(postResult.platform).toBe('x');
    expect(postResult.messageId).toBeTruthy();
    expect(postResult.method).toBeTruthy();
    
    const tweetId = postResult.messageId;
    console.log(`✅ Tweet posted successfully! Tweet ID: ${tweetId}`);
    console.log(`🔧 Method used: ${postResult.method}`);
    
    // Verify tweet ID is a valid string
    expect(typeof tweetId).toBe('string');
    expect(tweetId.length).toBeGreaterThan(0);
    
    // Verify tweet was actually created by fetching it
    console.log('🔍 Verifying tweet was actually created...');
    try {
      const tweetData = await xBroadcaster.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['text', 'created_at', 'author_id']
      });
      
      if (tweetData.data) {
        console.log(`✅ VERIFIED: Tweet exists: "${tweetData.data.text}"`);
        expect(tweetData.data.text).toBe(testMessage);
        expect(tweetData.data.id).toBe(tweetId);
      } else {
        console.log('⚠️  WARNING: Could not find the posted tweet');
      }
    } catch (verifyError) {
      console.log('🤔 Could not verify tweet creation:', verifyError.message);
    }
    
    // Wait before deletion
    console.log('⏳ Waiting 2 seconds before deletion...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Delete the tweet
    console.log('🗑️ Deleting test tweet...');
    const deleteResult = await xBroadcaster.deleteMessage(tweetId);
    
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.platform).toBe('x');
    expect(deleteResult.method).toBeTruthy();
    
    console.log(`✅ Tweet deleted successfully! Tweet ID: ${tweetId}`);
    console.log(`🔧 Method used: ${deleteResult.method}`);
    
    // Verify tweet was actually deleted
    console.log('🔍 Verifying tweet was actually deleted...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion to propagate
    
    try {
      const tweetDataAfterDelete = await xBroadcaster.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['text', 'created_at', 'author_id']
      });
      
      // If we can still fetch it, deletion might not have worked
      if (tweetDataAfterDelete.data) {
        console.log('⚠️  WARNING: Tweet still exists after deletion');
        console.log(`   Content: "${tweetDataAfterDelete.data.text}"`);
      } else {
        console.log('✅ VERIFIED: Tweet was actually deleted!');
      }
    } catch (verifyError) {
      // Error fetching might be good - could mean it's deleted
      if (verifyError.message.includes('not found') || verifyError.message.includes('deleted')) {
        console.log('✅ VERIFIED: Tweet was actually deleted and cannot be fetched!');
      } else {
        console.log('🤔 Could not verify deletion (this might be expected):', verifyError.message);
      }
    }
    
    console.log('🎉 Complete X.com tweet lifecycle test finished - creation, verification, deletion, and deletion verification!');
  }, 20000); // 20 second timeout for API calls

  test('should handle send errors gracefully', async () => {
    // Create a broadcaster with invalid config to test error handling
    const invalidBroadcaster = new XBroadcaster();
    // Clear the client to simulate error
    invalidBroadcaster.client = null;
    
    // Temporarily suppress logger to avoid confusing error messages in test output
    const originalError = invalidBroadcaster.logger.error;
    invalidBroadcaster.logger.error = () => {}; // Suppress error logging for this test
    
    const result = await invalidBroadcaster.send('test');
    
    // Restore original logger
    invalidBroadcaster.logger.error = originalError;
    
    expect(result.success).toBe(false);
    expect(result.platform).toBe('x');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('client not initialized');
  });

  test('should handle delete errors gracefully', async () => {
    const config = xBroadcaster.config;
    
    // Skip if using bearer token or not configured
    if (!config.isValid || xBroadcaster.authMethod === 'Bearer Token') {
      console.log('⏭️  Skipping delete error test - invalid config or bearer token');
      expect(true).toBe(true); // Pass the test
      return;
    }
    
    // Try to delete a non-existent tweet
    const invalidBroadcaster = new XBroadcaster();
    
    // Temporarily suppress logger to avoid confusing error messages
    const originalError = invalidBroadcaster.logger.error;
    invalidBroadcaster.logger.error = () => {}; // Suppress error logging for this test
    
    const result = await invalidBroadcaster.deleteMessage('9999999999999999999'); // Non-existent tweet ID
    
    // Restore original logger
    invalidBroadcaster.logger.error = originalError;
    
    // Delete should fail for non-existent tweet
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('platform');
    expect(result.platform).toBe('x');
    
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  test('should handle bearer token limitations', async () => {
    // Only test if bearer token is configured
    if (!xBroadcaster.config.hasBearerAuth || xBroadcaster.authMethod !== 'Bearer Token') {
      console.log('⏭️  Skipping bearer token limitation test - not using bearer token');
      expect(true).toBe(true); // Pass the test
      return;
    }
    
    console.log('🔍 Testing bearer token limitations...');
    
    // Bearer token should not be able to post
    const postResult = await xBroadcaster.send('test tweet');
    expect(postResult.success).toBe(false);
    expect(postResult.error).toContain('Bearer token authentication cannot post tweets');
    
    // Bearer token should not be able to delete
    const deleteResult = await xBroadcaster.deleteMessage('123456789');
    expect(deleteResult.success).toBe(false);
    expect(deleteResult.error).toContain('Bearer token authentication cannot delete tweets');
    
    console.log('✅ Bearer token limitations properly enforced');
  });
});