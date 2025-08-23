import { Config } from './config.mjs';
import { Logger } from './logger.mjs';

/**
 * Telegram broadcaster implementation
 */
export class TelegramBroadcaster {
  constructor() {
    this.name = 'telegram';
    this.displayName = 'Telegram';
    this.config = new Config();
    this.logger = new Logger(this.config.logLevel);
    this.baseUrl = null;
    
    if (this.config.telegram.botToken) {
      this.baseUrl = `https://api.telegram.org/bot${this.config.telegram.botToken}`;
    }
  }

  /**
   * Check if this broadcaster is properly configured
   */
  isConfigured() {
    const errors = this.config.validateTelegram();
    return errors.length === 0;
  }

  /**
   * Get configuration errors
   */
  getConfigurationErrors() {
    return this.config.validateTelegram();
  }

  /**
   * Send message to Telegram channel
   */
  async send(message) {
    try {
      this.logger.debug(`Sending message to Telegram channel: ${this.config.telegram.channelId}`);
      
      if (!this.baseUrl) {
        throw new Error('Telegram bot token not configured');
      }
      
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.config.telegram.channelId,
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