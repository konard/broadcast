import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * VK configuration class
 */
class VKConfig {
  constructor() {
    this.accessToken = getenv('VK_ACCESS_TOKEN', '');
    this.groupId = getenv('VK_GROUP_ID', '');
    this.apiVersion = getenv('VK_API_VERSION', '5.131');
    this.logLevel = getenv('LOG_LEVEL', 'info');
  }

  /**
   * Validate VK configuration
   * @returns {object} Object with errors array
   */
  validate() {
    const errors = [];
    
    if (!this.accessToken) {
      errors.push('VK_ACCESS_TOKEN is required');
    }
    
    if (!this.groupId) {
      errors.push('VK_GROUP_ID is required');
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
 * VK broadcaster implementation
 */
export class VKBroadcaster {
  constructor() {
    this.name = 'vk';
    this.displayName = 'VK';
    this.baseUrl = 'https://api.vk.com/method';
    
    // Initialize VK-specific configuration
    this.config = new VKConfig();
    this.logger = new Logger(this.config.logLevel);
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
   * Send message to VK wall
   */
  async send(message) {
    try {
      this.logger.debug(`Posting message to VK wall: ${this.config.groupId}`);
      
      const params = new URLSearchParams({
        owner_id: this.config.groupId,
        message: message,
        access_token: this.config.accessToken,
        v: this.config.apiVersion
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