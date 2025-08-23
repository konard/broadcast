#!/usr/bin/env bun

import TelegramBroadcaster from './telegram.mjs';

/**
 * Manual test to verify message deletion
 * This will post a message, wait, then try to delete it
 */

async function testDeletion() {
  console.log('🧪 Starting manual deletion test...\n');
  
  const broadcaster = new TelegramBroadcaster();
  
  // Enable debug logging by setting the log level in config
  broadcaster.config.logLevel = 'debug';
  broadcaster.logger = new (await import('./logger.mjs')).Logger('debug');
  
  if (!broadcaster.config.isValid) {
    console.error('❌ Configuration not valid');
    process.exit(1);
  }
  
  console.log('📝 Step 1: Posting test message...');
  const postResult = await broadcaster.send('🗑️ This message should be deleted automatically');
  
  if (!postResult.success) {
    console.error('❌ Failed to post message:', postResult.error);
    process.exit(1);
  }
  
  console.log(`✅ Message posted! ID: ${postResult.messageId}`);
  console.log(`🔧 Method: ${postResult.method}`);
  
  // Wait a bit to make sure the message is visible
  console.log('⏳ Waiting 3 seconds before deletion...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('🗑️ Step 2: Deleting message...');
  const deleteResult = await broadcaster.deleteMessage(postResult.messageId, postResult.chatEntity);
  
  if (deleteResult.success) {
    console.log('✅ Deletion API call succeeded');
    console.log('📋 Result:', deleteResult.result);
  } else {
    console.error('❌ Deletion failed:', deleteResult.error);
  }
  
  console.log('\n💡 Please check your Telegram chat to verify if the message was actually deleted.');
}

testDeletion().catch(console.error);