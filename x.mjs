import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * X.com configuration class
 */
class XConfig {
  constructor() {
    // OAuth 2.0 User Context (recommended for user actions)
    this.clientId = getenv('X_CLIENT_ID', '');
    this.clientSecret = getenv('X_CLIENT_SECRET', '');
    this.accessToken = getenv('X_ACCESS_TOKEN', '');
    this.accessTokenSecret = getenv('X_ACCESS_TOKEN_SECRET', '');
    
    // OAuth 1.0a User Context (alternative)
    this.apiKey = getenv('X_API_KEY', '');
    this.apiKeySecret = getenv('X_API_KEY_SECRET', '');
    
    // Bearer Token (for app-only auth, limited functionality)
    this.bearerToken = getenv('X_BEARER_TOKEN', '');
    
    this.logLevel = getenv('LOG_LEVEL', 'info');
  }

  /**
   * Check if OAuth 2.0 user authentication is configured
   */
  get hasOAuth2UserAuth() {
    return !!(this.clientId && this.clientSecret && this.accessToken && this.accessTokenSecret);
  }

  /**
   * Check if OAuth 1.0a user authentication is configured
   */
  get hasOAuth1UserAuth() {
    return !!(this.apiKey && this.apiKeySecret && this.accessToken && this.accessTokenSecret);
  }

  /**
   * Check if bearer token authentication is configured
   */
  get hasBearerAuth() {
    return !!this.bearerToken;
  }

  /**
   * Validate X.com configuration
   * @returns {object} Object with errors array
   */
  validate() {
    const errors = [];
    
    if (!this.hasOAuth2UserAuth && !this.hasOAuth1UserAuth && !this.hasBearerAuth) {
      errors.push('At least one authentication method is required: OAuth 2.0 user auth (X_CLIENT_ID + X_CLIENT_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET), OAuth 1.0a user auth (X_API_KEY + X_API_KEY_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET), or Bearer token (X_BEARER_TOKEN)');
    }
    
    if (this.hasOAuth2UserAuth) {
      if (!this.clientId) errors.push('X_CLIENT_ID is required for OAuth 2.0 user auth');
      if (!this.clientSecret) errors.push('X_CLIENT_SECRET is required for OAuth 2.0 user auth');
      if (!this.accessToken) errors.push('X_ACCESS_TOKEN is required for OAuth 2.0 user auth');
      if (!this.accessTokenSecret) errors.push('X_ACCESS_TOKEN_SECRET is required for OAuth 2.0 user auth');
    }
    
    if (this.hasOAuth1UserAuth && !this.hasOAuth2UserAuth) {
      if (!this.apiKey) errors.push('X_API_KEY is required for OAuth 1.0a user auth');
      if (!this.apiKeySecret) errors.push('X_API_KEY_SECRET is required for OAuth 1.0a user auth');
      if (!this.accessToken) errors.push('X_ACCESS_TOKEN is required for OAuth 1.0a user auth');
      if (!this.accessTokenSecret) errors.push('X_ACCESS_TOKEN_SECRET is required for OAuth 1.0a user auth');
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
 * X.com broadcaster implementation
 */
export class XBroadcaster {
  constructor() {
    this.name = 'x';
    this.displayName = 'X.com';
    
    // Initialize X-specific configuration
    this.config = new XConfig();
    this.logger = new Logger(this.config.logLevel);
    
    // Initialize Twitter API client
    this.client = null;
    this.initializeClient();
  }

  /**
   * Initialize Twitter API client based on available authentication
   */
  initializeClient() {
    try {
      if (this.config.hasOAuth2UserAuth) {
        // OAuth 2.0 User Context (preferred for user actions)
        this.client = new TwitterApi({
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        });
        
        // Set user context with access tokens
        this.client = this.client.withOAuth2Bearer({
          accessToken: this.config.accessToken,
          refreshToken: this.config.accessTokenSecret, // Note: This might need adjustment based on actual OAuth 2.0 flow
        });
        
        this.authMethod = 'OAuth 2.0 User';
        this.logger.debug('X.com client initialized with OAuth 2.0 user authentication');
        
      } else if (this.config.hasOAuth1UserAuth) {
        // OAuth 1.0a User Context
        this.client = new TwitterApi({
          appKey: this.config.apiKey,
          appSecret: this.config.apiKeySecret,
          accessToken: this.config.accessToken,
          accessSecret: this.config.accessTokenSecret,
        });
        
        this.authMethod = 'OAuth 1.0a User';
        this.logger.debug('X.com client initialized with OAuth 1.0a user authentication');
        
      } else if (this.config.hasBearerAuth) {
        // Bearer Token (app-only, limited functionality)
        this.client = new TwitterApi(this.config.bearerToken);
        this.authMethod = 'Bearer Token';
        this.logger.debug('X.com client initialized with Bearer token (limited functionality)');
        
      } else {
        this.logger.error('No valid X.com authentication method configured');
      }
    } catch (error) {
      this.logger.error('Failed to initialize X.com client:', error.message);
      this.client = null;
    }
  }

  /**
   * Check if this broadcaster is properly configured
   */
  isConfigured() {
    return this.config.isValid && this.client !== null;
  }

  /**
   * Get configuration errors
   */
  getConfigurationErrors() {
    const errors = this.config.validate().errors;
    if (this.config.isValid && !this.client) {
      errors.push('Failed to initialize X.com client');
    }
    return errors;
  }

  /**
   * Send tweet to X.com
   */
  async send(message) {
    try {
      this.logger.debug(`Posting tweet to X.com using ${this.authMethod}`);
      
      if (!this.client) {
        throw new Error('X.com client not initialized - check authentication credentials');
      }

      // Check if bearer token is being used (which has limited posting capabilities)
      if (this.authMethod === 'Bearer Token') {
        throw new Error('Bearer token authentication cannot post tweets - user authentication required');
      }
      
      const result = await this.client.v2.tweet(message);

      this.logger.info('✅ Tweet posted to X.com successfully');
      return {
        success: true,
        platform: this.name,
        result: result,
        messageId: result.data.id,  // Return the tweet ID for potential deletion
        method: this.authMethod
      };
    } catch (error) {
      this.logger.error('Failed to post X.com tweet:', error.message);
      return {
        success: false,
        platform: this.name,
        error: error.message
      };
    }
  }

  /**
   * Delete tweet from X.com
   */
  async deleteMessage(tweetId) {
    try {
      this.logger.debug(`Deleting tweet from X.com: ${tweetId}`);
      
      if (!this.client) {
        throw new Error('X.com client not initialized - check authentication credentials');
      }

      // Check if bearer token is being used (which cannot delete tweets)
      if (this.authMethod === 'Bearer Token') {
        throw new Error('Bearer token authentication cannot delete tweets - user authentication required');
      }
      
      const result = await this.client.v2.deleteTweet(tweetId);

      this.logger.info('✅ Tweet deleted from X.com successfully');
      return {
        success: true,
        platform: this.name,
        result: result,
        method: this.authMethod
      };
    } catch (error) {
      this.logger.error('Failed to delete X.com tweet:', error.message);
      return {
        success: false,
        platform: this.name,
        error: error.message
      };
    }
  }

  /**
   * Test the X.com configuration and connectivity
   */
  async test() {
    try {
      if (!this.isConfigured()) {
        const errors = this.getConfigurationErrors();
        return {
          success: false,
          platform: this.name,
          message: `X.com: Configuration errors - ${errors.join(', ')}`
        };
      }

      // For bearer token, we can only test by getting user info (limited)
      if (this.authMethod === 'Bearer Token') {
        return {
          success: true,
          platform: this.name,
          message: 'X.com: Bearer token authentication configured (limited functionality - cannot post/delete tweets)'
        };
      }

      // For user authentication, test by getting authenticated user info
      const userInfo = await this.client.v2.me();
      
      return {
        success: true,
        platform: this.name,
        message: `X.com: Connection successful using ${this.authMethod} (authenticated as @${userInfo.data.username})`
      };
    } catch (error) {
      return {
        success: false,
        platform: this.name,
        message: `X.com: ${error.message}`
      };
    }
  }
}

export default XBroadcaster;