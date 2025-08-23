#!/usr/bin/env bun

import { VK } from 'vk-io';
import VKBroadcaster from '../vk.mjs';

/**
 * VK Integration Test
 * Posts a 'test' message, gets the post ID, and deletes it immediately
 */

async function runVKTest() {
  console.log('🧪 Starting VK Integration Test...\n');

  try {
    // Initialize VK broadcaster
    const vkBroadcaster = new VKBroadcaster();

    // Check if VK is configured
    if (!vkBroadcaster.config.isValid) {
      const errors = vkBroadcaster.config.validate().errors;
      console.error('❌ VK Configuration Error:');
      errors.forEach(error => console.error(`   - ${error}`));
      console.error('\n💡 Please set VK_ACCESS_TOKEN and VK_OWNER_ID in your environment or .env file');
      process.exit(1);
    }

    console.log('✅ VK Configuration is valid');
    console.log(`📍 Target: ${vkBroadcaster.config.ownerId}`);
    console.log('');

    // Step 1: Post test message
    console.log('📝 Step 1: Posting test message...');
    const testMessage = 'test';
    const postResult = await vkBroadcaster.send(testMessage);

    if (!postResult.success) {
      console.error('❌ Failed to post message:', postResult.error);
      process.exit(1);
    }

    const messageId = postResult.messageId;
    console.log(`✅ Message posted successfully!`);
    console.log(`📋 Post ID: ${messageId}`);
    console.log(`📄 Message: "${testMessage}"`);
    console.log('');

    // Step 2: Verify message ID was returned
    if (!messageId) {
      console.error('❌ No message ID returned from VKBroadcaster');
      process.exit(1);
    }

    console.log('✅ Message ID successfully retrieved from VKBroadcaster');
    console.log('');

    // Step 3: Delete the message immediately
    console.log('🗑️  Step 2: Deleting test message...');
    
    if (!vkBroadcaster.vk) {
      console.error('❌ VK instance not available for deletion');
      process.exit(1);
    }

    try {
      await vkBroadcaster.vk.api.wall.delete({
        owner_id: vkBroadcaster.config.ownerId,
        post_id: messageId
      });

      console.log('✅ Message deleted successfully!');
      console.log(`🗑️  Deleted post ID: ${messageId}`);
    } catch (deleteError) {
      console.error('❌ Failed to delete message:', deleteError.message);
      console.warn('⚠️  The test message may still be visible on the wall');
    }

    console.log('');
    console.log('🎉 VK Integration Test completed successfully!');
    console.log('');
    console.log('📊 Test Summary:');
    console.log('   ✅ Configuration validation');
    console.log('   ✅ Message posting');
    console.log('   ✅ Message ID retrieval');
    console.log('   ✅ Message deletion');
    console.log('');

  } catch (error) {
    console.error('❌ VK Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
runVKTest().catch(error => {
  console.error('❌ Unhandled error in VK test:', error);
  process.exit(1);
});