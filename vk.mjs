import { Config } from './config.mjs';
import { Logger } from './logger.mjs';

/**
 * VK broadcaster implementation
 */
export class VKBroadcaster {
  constructor() {
    this.name = 'vk';
    this.displayName = 'VK';
    this.config = new Config();
    this.logger = new Logger(this.config.logLevel);
    this.baseUrl = 'https://api.vk.com/method';
  }

  /**
   * Check if this broadcaster is properly configured
   */
  isConfigured() {
    const errors = this.config.validateVK();
    return errors.length === 0;
  }

  /**
   * Get configuration errors
   */
  getConfigurationErrors() {
    return this.config.validateVK();
  }

  /**
   * Send message to VK wall
   */
  async send(message) {
    try {
      this.logger.debug(`Posting message to VK wall: ${this.config.vk.groupId}`);
      
      const params = new URLSearchParams({
        owner_id: this.config.vk.groupId,
        message: message,
        access_token: this.config.vk.accessToken,
        v: this.config.vk.apiVersion
      });

      const response = await fetch(`${this.baseUrl}/wall.post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`VK API error: ${result.error.error_msg}`);
      }

      this.logger.info('✅ Message posted to VK wall successfully');
      return {
        success: true,
        platform: this.name,
        result: result
      };
    } catch (error) {
      this.logger.error('Failed to post VK message:', error.message);
      return {
        success: false,
        platform: this.name,
        error: error.message
      };
    }
  }

  /**
   * Test the VK configuration and connectivity
   */
  async test() {
    try {
      const testMessage = '🧪 Test message from broadcast CLI';
      const result = await this.send(testMessage);
      
      if (result.success) {
        return {
          success: true,
          platform: this.name,
          message: 'VK: Connection successful'
        };
      } else {
        return {
          success: false,
          platform: this.name,
          message: `VK: ${result.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        platform: this.name,
        message: `VK: ${error.message}`
      };
    }
  }
}

export default VKBroadcaster;