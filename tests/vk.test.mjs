import { describe, test, expect, beforeAll } from 'bun:test';
import VKBroadcaster from '../vk.mjs';

/**
 * VK Integration Test Suite
 * Tests VK broadcasting functionality with post/delete cycle
 * 
 * NOTE: These tests are skipped to avoid real API requests
 * To enable: replace 'describe.skip' with 'describe'
 */

describe.skip('VK Integration Tests', () => {
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
    console.log('📝 Step 1: Posting test message...');
    const postResult = await vkBroadcaster.send(testMessage);
    
    expect(postResult.success).toBe(true);
    expect(postResult.platform).toBe('vk');
    expect(postResult.messageId).toBeTruthy();
    
    const messageId = postResult.messageId;
    console.log(`✅ Message posted successfully! Post ID: ${messageId}`);
    
    // Step 2: Verify message ID is a valid number
    expect(typeof messageId).toBe('number');
    expect(messageId).toBeGreaterThan(0);
    
    // Step 3: Verify message was actually created by fetching it
    console.log('🔍 Step 2: Verifying message was actually created...');
    try {
      const posts = await vkBroadcaster.vk.api.wall.get({
        owner_id: vkBroadcaster.config.ownerId,
        count: 10
      });
      
      const createdPost = posts.items.find(post => post.id === messageId);
      if (createdPost) {
        console.log(`✅ VERIFIED: Message exists on wall: "${createdPost.text}"`);
        expect(createdPost.text).toBe(testMessage);
      } else {
        console.log('⚠️  WARNING: Could not find the posted message in recent posts');
      }
    } catch (verifyError) {
      console.log('🤔 Could not verify message creation:', verifyError.message);
    }
    
    // Step 4: Wait before deletion
    console.log('⏳ Step 3: Waiting 2 seconds before deletion...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Delete the message via VKBroadcaster (not direct API)
    console.log('🗑️ Step 4: Deleting test message via VKBroadcaster...');
    
    // Note: VKBroadcaster doesn't have deleteMessage method yet, so using direct API
    // TODO: Implement deleteMessage method in VKBroadcaster for consistency
    const deleteResult = await vkBroadcaster.vk.api.wall.delete({
      owner_id: vkBroadcaster.config.ownerId,
      post_id: messageId
    });
    
    expect(deleteResult).toBeTruthy();
    console.log(`✅ Message deletion API call successful! Post ID: ${messageId}`);
    
    // Step 6: Verify message was actually deleted
    console.log('🔍 Step 5: Verifying message was actually deleted...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion to propagate
    
    try {
      const postsAfterDelete = await vkBroadcaster.vk.api.wall.get({
        owner_id: vkBroadcaster.config.ownerId,
        count: 20 // Check more posts to be sure
      });
      
      const stillExists = postsAfterDelete.items.find(post => post.id === messageId);
      if (!stillExists) {
        console.log('✅ VERIFIED: Message was actually deleted and no longer exists on wall!');
      } else {
        console.log('⚠️  WARNING: Message still exists on wall after deletion');
        console.log(`   Content: "${stillExists.text}"`);
      }
    } catch (verifyError) {
      console.log('🤔 Could not verify deletion (this might be expected):', verifyError.message);
    }
    
    console.log('🎉 Complete VK message lifecycle test finished - creation, verification, deletion, and deletion verification!');
  }, 15000); // 15 second timeout for API calls

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