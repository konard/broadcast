#!/usr/bin/env bun

/**
 * Direct API test for message deletion
 */

async function testDirectAPI() {
  console.log('🧪 Direct API deletion test...\n');
  
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
    // Get channel entity
    const channel = await client.getEntity('@link_konard');
    console.log(`📍 Channel: ${channel.title} (@${channel.username})`);
    console.log(`🏷️  Type: ${channel.className}, broadcast: ${channel.broadcast}`);
    
    // Send a test message
    console.log('📝 Sending test message...');
    const message = await client.sendMessage(channel, {
      message: '🗑️ Direct API test message - should be deleted',
    });
    
    console.log(`✅ Message sent! ID: ${message.id}`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try deleting with channels.deleteMessages
    console.log('🗑️ Trying channels.deleteMessages...');
    try {
      const result1 = await client.invoke(
        new Api.channels.DeleteMessages({
          channel: channel,
          id: [message.id]
        })
      );
      console.log('✅ channels.deleteMessages result:', result1);
    } catch (error) {
      console.log('❌ channels.deleteMessages failed:', error.message);
      
      // Try with messages.deleteMessages as fallback
      console.log('🗑️ Trying messages.deleteMessages as fallback...');
      try {
        const result2 = await client.invoke(
          new Api.messages.DeleteMessages({
            id: [message.id],
            revoke: true
          })
        );
        console.log('✅ messages.deleteMessages result:', result2);
      } catch (error2) {
        console.log('❌ messages.deleteMessages also failed:', error2.message);
      }
    }
    
  } finally {
    await client.disconnect();
  }
}

testDirectAPI().catch(console.error);