import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * VK broadcaster implementation
 */
export class VKBroadcaster {
  constructor() {
    this.name = 'vk';
    this.displayName = 'VK';
    this.baseUrl = 'https://api.vk.com/method';
    
    // Initialize VK-specific configuration using getenv
    this.accessToken = getenv('VK_ACCESS_TOKEN', '');
    this.groupId = getenv('VK_GROUP_ID', '');
    this.apiVersion = getenv('VK_API_VERSION', '5.131');
    this.logLevel = getenv('LOG_LEVEL', 'info');
    
    this.logger = new Logger(this.logLevel);
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
    
    if (!this.accessToken) {
      errors.push('VK_ACCESS_TOKEN is required');
    }
    
    if (!this.groupId) {
      errors.push('VK_GROUP_ID is required');
    }
    
    return errors;
  }

  /**
   * Send message to VK wall
   */
  async send(message) {
    try {
      this.logger.debug(`Posting message to VK wall: ${this.groupId}`);
      
      const params = new URLSearchParams({
        owner_id: this.groupId,
        message: message,
        access_token: this.accessToken,
        v: this.apiVersion
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