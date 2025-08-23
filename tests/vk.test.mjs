import { describe, test, expect, beforeAll } from 'bun:test';
import VKBroadcaster from '../vk.mjs';

/**
 * VK Integration Test Suite
 * Tests VK broadcasting functionality with post/delete cycle
 */

describe('VK Integration Tests', () => {
  let vkBroadcaster;
  let testMessage;

  beforeAll(() => {
    vkBroadcaster = new VKBroadcaster();
    testMessage = 'test';
  });

  test('should have valid VK configuration', () => {
    if (!vkBroadcaster.config.isValid) {
      const errors = vkBroadcaster.config.validate().errors;
      console.error('❌ VK Configuration Error:');
      errors.forEach(error => console.error(`   - ${error}`));
      console.error('\n💡 Please set VK_ACCESS_TOKEN and VK_OWNER_ID in your environment or .env file');
    }
    
    expect(vkBroadcaster.config.isValid).toBe(true);
    expect(vkBroadcaster.config.accessToken).toBeTruthy();
    expect(vkBroadcaster.config.ownerId).toBeTruthy();
  });

  test('should have VK instance initialized', () => {
    expect(vkBroadcaster.vk).toBeTruthy();
    expect(vkBroadcaster.vk.api).toBeTruthy();
  });

  test('should post message, get ID, and delete successfully', async () => {
    // Step 1: Post test message
    console.log('📝 Posting test message...');
    const postResult = await vkBroadcaster.send(testMessage);
    
    expect(postResult.success).toBe(true);
    expect(postResult.platform).toBe('vk');
    expect(postResult.messageId).toBeTruthy();
    
    const messageId = postResult.messageId;
    console.log(`✅ Message posted successfully! Post ID: ${messageId}`);
    
    // Step 2: Verify message ID is a valid number
    expect(typeof messageId).toBe('number');
    expect(messageId).toBeGreaterThan(0);
    
    // Step 3: Delete the message immediately
    console.log('🗑️  Deleting test message...');
    
    const deleteResult = await vkBroadcaster.vk.api.wall.delete({
      owner_id: vkBroadcaster.config.ownerId,
      post_id: messageId
    });
    
    expect(deleteResult).toBeTruthy();
    console.log(`✅ Message deleted successfully! Post ID: ${messageId}`);
  }, 10000); // 10 second timeout for API calls

  test('should handle send errors gracefully', async () => {
    // Create a broadcaster with invalid config to test error handling
    const invalidBroadcaster = new VKBroadcaster();
    // Clear the VK instance to simulate error
    invalidBroadcaster.vk = null;
    
    // Temporarily suppress logger to avoid confusing error messages in test output
    const originalError = invalidBroadcaster.logger.error;
    invalidBroadcaster.logger.error = () => {}; // Suppress error logging for this test
    
    const result = await invalidBroadcaster.send('test');
    
    // Restore original logger
    invalidBroadcaster.logger.error = originalError;
    
    expect(result.success).toBe(false);
    expect(result.platform).toBe('vk');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('VK instance not initialized');
  });
});