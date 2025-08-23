import getenv from 'getenv';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

// Dynamic imports for user auth (only when needed)
let telegram, input;

async function loadUserAuthDependencies() {
  if (!telegram) {
    const { default: telegramLib } = await import('telegram');
    telegram = telegramLib;
  }
  if (!input) {
    const { default: readlineSync } = await import('readline-sync');
    input = readlineSync;
  }
  return { telegram, input };
}

/**
 * Telegram configuration class
 */
class TelegramConfig {
  constructor() {
    // Bot authentication
    this.botToken = getenv('TELEGRAM_BOT_TOKEN', '');
    this.channelId = getenv('TELEGRAM_CHANNEL_ID', '');
    
    // User authentication (optional)
    this.userBotApiId = getenv('TELEGRAM_USER_BOT_API_ID', '');
    this.userBotApiHash = getenv('TELEGRAM_USER_BOT_API_HASH', '');
    this.userBotPhone = getenv('TELEGRAM_USER_BOT_PHONE', '');
    this.userBotChatUsername = getenv('TELEGRAM_USER_BOT_CHAT_USERNAME', '');
    this.userBotChatId = getenv('TELEGRAM_USER_BOT_CHAT_ID', '');
    
    this.logLevel = getenv('LOG_LEVEL', 'info');
  }

  /**
   * Check if bot authentication is configured
   */
  get hasBotAuth() {
    return !!(this.botToken && this.channelId);
  }

  /**
   * Check if user authentication is configured
   */
  get hasUserAuth() {
    return !!(this.userBotApiId && this.userBotApiHash && this.userBotPhone && 
             (this.userBotChatUsername || this.userBotChatId));
  }

  /**
   * Validate Telegram configuration
   * @returns {object} Object with errors array
   */
  validate() {
    const errors = [];
    
    if (!this.hasBotAuth && !this.hasUserAuth) {
      errors.push('Either bot authentication (TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID) or user authentication (TELEGRAM_USER_BOT_*) is required');
    }
    
    if (this.hasUserAuth) {
      if (!this.userBotApiId) errors.push('TELEGRAM_USER_BOT_API_ID is required for user auth');
      if (!this.userBotApiHash) errors.push('TELEGRAM_USER_BOT_API_HASH is required for user auth');
      if (!this.userBotPhone) errors.push('TELEGRAM_USER_BOT_PHONE is required for user auth');
      if (!this.userBotChatUsername && !this.userBotChatId) {
        errors.push('Either TELEGRAM_USER_BOT_CHAT_USERNAME or TELEGRAM_USER_BOT_CHAT_ID is required for user auth');
      }
    }
    
    return { errors };
  }

  /**
   * Check if configuration is valid
   * @returns {boolean}
   */
  get isValid() {
    return this.validate().errors.length === 0;
  }
}

/**
 * Initialize Telegram user client connection
 */
async function initTelegramUserConnection(config, logger) {
  const { telegram, input } = await loadUserAuthDependencies();
  
  // Exit immediately on any unhandled rejections or uncaught exceptions
  process.on('unhandledRejection', err => {
    logger.error('Unhandled Rejection:', err);
    process.exit(1);
  });
  process.on('uncaughtException', err => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });

  const { TelegramClient, Api } = telegram;
  const { StringSession } = telegram.sessions;

  // Read API credentials
  const apiId = config.userBotApiId || input.question('Enter your Telegram API ID: ');
  const apiHash = config.userBotApiHash || input.question('Enter your Telegram API Hash: ');

  // Load or create session from file
  const sessionFile = './.telegram_session';
  const fileExists = fs.existsSync(sessionFile);
  let storedSession = '';
  if (fileExists) {
    try {
      storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
    } catch (err) {
      logger.error('Error reading session file:', err);
      throw err;
    }
  }
  const stringSession = new StringSession(storedSession);
  const client = new TelegramClient(stringSession, parseInt(apiId, 10), apiHash, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => config.userBotPhone || input.question('Enter your phone number: '),
    password: async () => input.question('Enter your 2FA password (if any): '),
    phoneCode: async () => input.question('Enter the code you received: '),
    onError: err => logger.error(err),
  });
  logger.info('Connected to Telegram user client.');

  // Save new session after first run
  if (!fileExists) {
    try {
      await fs.promises.writeFile(sessionFile, client.session.save(), 'utf8');
      logger.info(`Saved session to ${sessionFile}`);
    } catch (err) {
      logger.error('Error writing session file:', err);
      throw err;
    }
  }

  return { client, Api };
}

/**
 * Use Telegram user client with automatic cleanup
 */
async function usingTelegramUser(config, logger, fn) {
  const { client, Api } = await initTelegramUserConnection(config, logger);
  try {
    return await fn({ client, Api });
  } finally {
    await client.disconnect();
  }
}

/**
 * Telegram broadcaster implementation
 */
export class TelegramBroadcaster {
  constructor() {
    this.name = 'telegram';
    this.displayName = 'Telegram';
    
    // Initialize Telegram-specific configuration
    this.config = new TelegramConfig();
    this.logger = new Logger(this.config.logLevel);
    this.baseUrl = null;
    
    // Initialize bot API if configured
    if (this.config.botToken) {
      this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
    }
    
    // Log authentication method
    if (this.config.hasBotAuth && this.config.hasUserAuth) {
      this.logger.debug('Both bot and user auth configured, will prefer bot auth');
    } else if (this.config.hasBotAuth) {
      this.logger.debug('Bot authentication configured');
    } else if (this.config.hasUserAuth) {
      this.logger.debug('User authentication configured');
    }
  }

  /**
   * Check if this broadcaster is properly configured
   */
  isConfigured() {
    return this.config.isValid;
  }

  /**
   * Get configuration errors
   */
  getConfigurationErrors() {
    return this.config.validate().errors;
  }

  /**
   * Send message to Telegram channel
   */
  async send(message) {
    try {
      // Prefer bot authentication if available
      if (this.config.hasBotAuth) {
        return await this.sendViaBot(message);
      } else if (this.config.hasUserAuth) {
        return await this.sendViaUser(message);
      } else {
        throw new Error('No valid authentication method configured');
      }
    } catch (error) {
      this.logger.error('Failed to send Telegram message:', error.message);
      return {
        success: false,
        platform: this.name,
        error: error.message
      };
    }
  }

  /**
   * Send message via Bot API
   */
  async sendViaBot(message) {
    this.logger.debug(`Sending message via Bot API to: ${this.config.channelId}`);
    
    if (!this.baseUrl) {
      throw new Error('Telegram bot token not configured');
    }
    
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: this.config.channelId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.logger.info('✅ Message sent to Telegram via Bot API successfully');
    return {
      success: true,
      platform: this.name,
      method: 'bot',
      result: result,
      messageId: result.result.message_id  // Return the message ID for deletion
    };
  }

  /**
   * Send message via User Client
   */
  async sendViaUser(message) {
    this.logger.debug(`Sending message via User Client to: ${this.config.userBotChatUsername || this.config.userBotChatId}`);
    
    return await usingTelegramUser(this.config, this.logger, async ({ client, Api }) => {
      // Resolve chat entity
      let chatEntity;
      if (this.config.userBotChatUsername) {
        chatEntity = await client.getEntity(this.config.userBotChatUsername);
      } else {
        chatEntity = await client.getEntity(parseInt(this.config.userBotChatId, 10));
      }
      
      // Send message
      const result = await client.sendMessage(chatEntity, {
        message: message,
        parseMode: 'html'
      });
      
      this.logger.info('✅ Message sent to Telegram via User Client successfully');
      return {
        success: true,
        platform: this.name,
        method: 'user',
        result: result,
        messageId: result.id,  // Return the message ID for deletion
        chatEntity: chatEntity  // Store the resolved chat entity for deletion
      };
    });
  }

  /**
   * Delete message by ID
   */
  async deleteMessage(messageId, chatEntityOrId = null) {
    try {
      // Prefer bot authentication if available
      if (this.config.hasBotAuth) {
        return await this.deleteViaBot(messageId, chatEntityOrId);
      } else if (this.config.hasUserAuth) {
        return await this.deleteViaUser(messageId, chatEntityOrId);
      } else {
        throw new Error('No valid authentication method configured');
      }
    } catch (error) {
      this.logger.error('Failed to delete Telegram message:', error.message);
      return {
        success: false,
        platform: this.name,
        error: error.message
      };
    }
  }

  /**
   * Delete message via Bot API
   */
  async deleteViaBot(messageId, chatId = null) {
    this.logger.debug(`Deleting message via Bot API: ${messageId}`);
    
    if (!this.baseUrl) {
      throw new Error('Telegram bot token not configured');
    }
    
    const targetChatId = chatId || this.config.channelId;
    
    const response = await fetch(`${this.baseUrl}/deleteMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        message_id: messageId
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.logger.info('✅ Message deleted from Telegram via Bot API successfully');
    return {
      success: true,
      platform: this.name,
      method: 'bot',
      result: result
    };
  }

  /**
   * Delete message via User Client
   */
  async deleteViaUser(messageId, chatEntity = null) {
    this.logger.debug(`Deleting message via User Client: ${messageId}`);
    
    return await usingTelegramUser(this.config, this.logger, async ({ client, Api }) => {
      // Resolve chat entity if not provided
      let targetChatEntity = chatEntity;
      if (!targetChatEntity) {
        if (this.config.userBotChatUsername) {
          targetChatEntity = await client.getEntity(this.config.userBotChatUsername);
        } else {
          targetChatEntity = await client.getEntity(parseInt(this.config.userBotChatId, 10));
        }
      }
      
      // Log detailed entity information
      this.logger.debug(`Chat entity details:`);
      this.logger.debug(`- className: ${targetChatEntity.className}`);
      this.logger.debug(`- id: ${targetChatEntity.id}`);
      if (targetChatEntity.username) this.logger.debug(`- username: ${targetChatEntity.username}`);
      if (targetChatEntity.title) this.logger.debug(`- title: ${targetChatEntity.title}`);
      if (targetChatEntity.megagroup !== undefined) this.logger.debug(`- megagroup: ${targetChatEntity.megagroup}`);
      if (targetChatEntity.broadcast !== undefined) this.logger.debug(`- broadcast: ${targetChatEntity.broadcast}`);
      
      // Determine the correct API method based on entity type
      let result;
      if (targetChatEntity.className === 'Channel') {
        // Channels and supergroups use channels.deleteMessages
        this.logger.debug('Using Api.channels.deleteMessages for Channel');
        result = await client.invoke(
          new Api.channels.DeleteMessages({
            channel: targetChatEntity,
            id: [messageId]
          })
        );
      } else if (targetChatEntity.className === 'Chat') {
        // Regular group chats
        if (targetChatEntity.megagroup) {
          // Megagroups (supergroups) are technically channels
          this.logger.debug('Using Api.channels.deleteMessages for Megagroup');
          result = await client.invoke(
            new Api.channels.DeleteMessages({
              channel: targetChatEntity,
              id: [messageId]
            })
          );
        } else {
          // Regular group chats use messages.deleteMessages
          this.logger.debug('Using Api.messages.deleteMessages for regular Chat');
          result = await client.invoke(
            new Api.messages.DeleteMessages({
              id: [messageId],
              revoke: true
            })
          );
        }
      } else {
        // User conversations use messages.deleteMessages
        this.logger.debug('Using Api.messages.deleteMessages for User conversation');
        result = await client.invoke(
          new Api.messages.DeleteMessages({
            id: [messageId],
            revoke: true
          })
        );
      }
      
      this.logger.info('✅ Message deleted from Telegram via User Client successfully');
      return {
        success: true,
        platform: this.name,
        method: 'user',
        result: result
      };
    });
  }

  /**
   * Test the Telegram configuration and connectivity
   */
  async test() {
    try {
      const testMessage = '🧪 Test message from broadcast CLI';
      const result = await this.send(testMessage);
      
      if (result.success) {
        // Clean up the test message
        try {
          await this.deleteMessage(result.messageId, result.chatEntity);
          this.logger.debug('Test message cleaned up successfully');
        } catch (deleteError) {
          this.logger.warn('Failed to clean up test message:', deleteError.message);
        }
        
        return {
          success: true,
          platform: this.name,
          message: 'Telegram: Connection successful'
        };
      } else {
        return {
          success: false,
          platform: this.name,
          message: `Telegram: ${result.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        platform: this.name,
        message: `Telegram: ${error.message}`
      };
    }
  }
}

export default TelegramBroadcaster;