import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * Telegram broadcaster implementation
 */
export class TelegramBroadcaster {
  constructor() {
    this.name = 'telegram';
    this.displayName = 'Telegram';
    
    // Initialize Telegram-specific configuration using getenv
    this.botToken = getenv('TELEGRAM_BOT_TOKEN', '');
    this.channelId = getenv('TELEGRAM_CHANNEL_ID', '');
    this.logLevel = getenv('LOG_LEVEL', 'info');
    
    this.logger = new Logger(this.logLevel);
    this.baseUrl = null;
    
    if (this.botToken) {
      this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    }
  }

  /**
   * Check if this broadcaster is properly configured
   */
  isConfigured() {
    const errors = this.getConfigurationErrors();
    return errors.length === 0;
  }

  /**
   * Get configuration errors
   */
  getConfigurationErrors() {
    const errors = [];
    
    if (!this.botToken) {
      errors.push('TELEGRAM_BOT_TOKEN is required');
    }
    
    if (!this.channelId) {
      errors.push('TELEGRAM_CHANNEL_ID is required');
    }
    
    return errors;
  }

  /**
   * Send message to Telegram channel
   */
  async send(message) {
    try {
      this.logger.debug(`Sending message to Telegram channel: ${this.channelId}`);
      
      if (!this.baseUrl) {
        throw new Error('Telegram bot token not configured');
      }
      
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.channelId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      this.logger.info('✅ Message sent to Telegram successfully');
      return {
        success: true,
        platform: this.name,
        result: result
      };
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
   * Test the Telegram configuration and connectivity
   */
  async test() {
    try {
      const testMessage = '🧪 Test message from broadcast CLI';
      const result = await this.send(testMessage);
      
      if (result.success) {
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