import * as dotenv from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

/**
 * Configuration class to manage all settings
 */
export class Config {
  constructor() {
    this.telegram = {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      channelId: process.env.TELEGRAM_CHANNEL_ID
    };
    
    this.vk = {
      accessToken: process.env.VK_ACCESS_TOKEN,
      groupId: process.env.VK_GROUP_ID,
      apiVersion: process.env.VK_API_VERSION || '5.131'
    };
    
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  validate() {
    const errors = [];
    
    if (!this.telegram.botToken) {
      errors.push('TELEGRAM_BOT_TOKEN is required');
    }
    
    if (!this.telegram.channelId) {
      errors.push('TELEGRAM_CHANNEL_ID is required');
    }
    
    if (!this.vk.accessToken) {
      errors.push('VK_ACCESS_TOKEN is required');
    }
    
    if (!this.vk.groupId) {
      errors.push('VK_GROUP_ID is required');
    }
    
    return errors;
  }

  validateTelegram() {
    const errors = [];
    
    if (!this.telegram.botToken) {
      errors.push('TELEGRAM_BOT_TOKEN is required');
    }
    
    if (!this.telegram.channelId) {
      errors.push('TELEGRAM_CHANNEL_ID is required');
    }
    
    return errors;
  }

  validateVK() {
    const errors = [];
    
    if (!this.vk.accessToken) {
      errors.push('VK_ACCESS_TOKEN is required');
    }
    
    if (!this.vk.groupId) {
      errors.push('VK_GROUP_ID is required');
    }
    
    return errors;
  }

  hasEnvFile() {
    return existsSync('.env');
  }
}

export default Config;