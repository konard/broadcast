#!/usr/bin/env bun

import TelegramBroadcaster from './telegram.mjs';

/**
 * Check what type of entity we're dealing with
 */

async function checkEntity() {
  console.log('🔍 Checking entity type...\n');
  
  const broadcaster = new TelegramBroadcaster();
  
  if (!broadcaster.config.isValid) {
    console.error('❌ Configuration not valid');
    process.exit(1);
  }
  
  console.log(`📍 Target: ${broadcaster.config.userBotChatUsername || broadcaster.config.userBotChatId}`);
  
  // Get entity details
  const { initTelegramUserConnection } = await import('./telegram.mjs');
  
  // Use dynamic import to access the internal function
  await broadcaster.config.isValid && (() => {
    return import('./telegram.mjs').then(async (mod) => {
      // Access the usingTelegramUser function through the module
      const config = broadcaster.config;
      const logger = broadcaster.logger;
      
      // Manual implementation similar to usingTelegramUser
      const telegram = (await import('telegram')).default;
      const { TelegramClient } = telegram;
      const { StringSession } = telegram.sessions;
      
      const apiId = config.userBotApiId;
      const apiHash = config.userBotApiHash;
      
      const sessionFile = './.telegram_session';
      const fs = await import('fs');
      let storedSession = '';
      if (fs.existsSync(sessionFile)) {
        storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
      }
      
      const stringSession = new StringSession(storedSession);
      const client = new TelegramClient(stringSession, parseInt(apiId, 10), apiHash, { connectionRetries: 5 });
      
      await client.connect();
      
      try {
        const entity = config.userBotChatUsername 
          ? await client.getEntity(config.userBotChatUsername)
          : await client.getEntity(parseInt(config.userBotChatId, 10));
        
        console.log('📋 Entity Details:');
        console.log(`   - className: ${entity.className}`);
        console.log(`   - id: ${entity.id}`);
        if (entity.username) console.log(`   - username: @${entity.username}`);
        if (entity.title) console.log(`   - title: ${entity.title}`);
        if (entity.megagroup !== undefined) console.log(`   - megagroup: ${entity.megagroup}`);
        if (entity.broadcast !== undefined) console.log(`   - broadcast: ${entity.broadcast}`);
        if (entity.creator !== undefined) console.log(`   - creator: ${entity.creator}`);
        if (entity.adminRights) console.log(`   - adminRights: ${JSON.stringify(entity.adminRights)}`);
        if (entity.defaultBannedRights) console.log(`   - defaultBannedRights: ${JSON.stringify(entity.defaultBannedRights)}`);
        
        // Determine what API to use
        let apiMethod = 'unknown';
        if (entity.className === 'Channel') {
          apiMethod = 'channels.deleteMessages';
        } else if (entity.className === 'Chat') {
          apiMethod = entity.megagroup ? 'channels.deleteMessages' : 'messages.deleteMessages';
        } else {
          apiMethod = 'messages.deleteMessages';
        }
        
        console.log(`\n🔧 Recommended API: ${apiMethod}`);
        
        // Check permissions
        if (entity.className === 'Channel') {
          const canDelete = entity.creator || 
                          (entity.adminRights && entity.adminRights.deleteMessages) ||
                          entity.defaultBannedRights?.deleteMessages !== true;
          console.log(`🔑 Can likely delete messages: ${canDelete ? 'YES' : 'NO'}`);
          
          if (!canDelete) {
            console.log('⚠️  Note: You may only be able to delete your own messages within 48 hours');
          }
        }
        
      } finally {
        await client.disconnect();
      }
    });
  })();
}

checkEntity().catch(console.error);