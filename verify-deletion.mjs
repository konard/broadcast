#!/usr/bin/env bun

/**
 * Comprehensive deletion verification test
 * Posts message, deletes it, then verifies it's actually gone
 */

async function verifyDeletion() {
  console.log('🔍 Comprehensive deletion verification test...\n');
  
  const telegram = (await import('telegram')).default;
  const fs = await import('fs');
  const { TelegramClient, Api } = telegram;
  const { StringSession } = telegram.sessions;
  
  // Load session
  const sessionFile = './.telegram_session';
  let storedSession = '';
  if (fs.existsSync(sessionFile)) {
    storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
  }
  
  const apiId = process.env.TELEGRAM_USER_BOT_API_ID || '24617061';
  const apiHash = process.env.TELEGRAM_USER_BOT_API_HASH || 'f3c377da172235d8109d241c6fdda6b4';
  
  const stringSession = new StringSession(storedSession);
  const client = new TelegramClient(stringSession, parseInt(apiId, 10), apiHash, { connectionRetries: 5 });
  
  await client.connect();
  
  try {
    const channel = await client.getEntity('@link_konard');
    console.log(`📍 Channel: ${channel.title} (@${channel.username})`);
    
    // Step 1: Send a test message
    console.log('📝 Step 1: Sending test message...');
    const message = await client.sendMessage(channel, {
      message: '🧪 Verification test - this message should be deleted and verified as gone',
    });
    
    const messageId = message.id;
    console.log(`✅ Message sent! ID: ${messageId}`);
    
    // Step 2: Verify message exists by fetching it
    console.log('🔍 Step 2: Verifying message exists...');
    try {
      const messages = await client.getMessages(channel, { ids: [messageId] });
      if (messages.length > 0 && messages[0].id === messageId) {
        console.log(`✅ Message confirmed to exist: "${messages[0].message}"`);
      } else {
        console.log('❌ Message not found after sending (this is unexpected)');
        return;
      }
    } catch (error) {
      console.log('❌ Could not verify message exists:', error.message);
      return;
    }
    
    // Step 3: Delete the message
    console.log('🗑️ Step 3: Deleting message...');
    const deleteResult = await client.invoke(
      new Api.channels.DeleteMessages({
        channel: channel,
        id: [messageId]
      })
    );
    console.log(`✅ Delete API call completed:`, deleteResult);
    
    // Step 4: Wait a moment for deletion to propagate
    console.log('⏳ Step 4: Waiting 3 seconds for deletion to propagate...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Try to fetch the message again to verify it's gone
    console.log('🔍 Step 5: Verifying message is actually deleted...');
    try {
      const messagesAfterDelete = await client.getMessages(channel, { ids: [messageId] });
      
      if (messagesAfterDelete.length === 0 || !messagesAfterDelete[0] || messagesAfterDelete[0].className === 'MessageEmpty') {
        console.log('✅ SUCCESS: Message was actually deleted and cannot be fetched!');
      } else if (messagesAfterDelete[0].id === messageId) {
        console.log('❌ PROBLEM: Message still exists and can be fetched:');
        console.log(`   Content: "${messagesAfterDelete[0].message}"`);
        console.log('   This suggests the deletion did not actually work.');
      } else {
        console.log('🤔 UNCLEAR: Got unexpected response:', messagesAfterDelete);
      }
    } catch (error) {
      // This might actually be good - if we get an error fetching, it might mean it's deleted
      console.log('🤔 Got error fetching deleted message (this might be expected):', error.message);
    }
    
    // Step 6: Check recent messages to see if it's still in the channel
    console.log('📜 Step 6: Checking recent channel messages...');
    try {
      const recentMessages = await client.getMessages(channel, { limit: 10 });
      const stillExists = recentMessages.some(msg => msg.id === messageId);
      
      if (stillExists) {
        console.log('❌ PROBLEM: Message still appears in recent messages list');
      } else {
        console.log('✅ GOOD: Message does not appear in recent messages list');
      }
    } catch (error) {
      console.log('❌ Could not check recent messages:', error.message);
    }
    
  } finally {
    await client.disconnect();
  }
}

verifyDeletion().catch(console.error);