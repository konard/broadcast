import getenv from 'getenv';
import * as dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import { Logger } from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * Supported X.com authentication modes.
 *
 * - oauth2:  OAuth 2.0 user-context access token (Authorization Code with PKCE).
 *            The SDK client is built from the token string (bearer auth).
 *            Client ID/secret are only needed to obtain/refresh tokens, not to post.
 * - oauth1:  OAuth 1.0a user context: API key/secret + access token/secret
 *            (the four-field SDK constructor).
 * - app:     Application-only bearer token. Read-only, can never post.
 */
export const X_AUTH_MODES = {
  OAUTH2_USER: 'oauth2',
  OAUTH1_USER: 'oauth1',
  APP_ONLY: 'app'
};

const AUTH_METHOD_LABELS = {
  oauth2: 'OAuth 2.0 User',
  oauth1: 'OAuth 1.0a User',
  app: 'App-only Bearer Token'
};

const MODE_ALIASES = {
  oauth2: 'oauth2', 'oauth2-user': 'oauth2',
  oauth1: 'oauth1', 'oauth1a': 'oauth1', 'oauth1-user': 'oauth1',
  app: 'app', 'app-only': 'app', bearer: 'app'
};

/**
 * X.com configuration class
 */
export class XConfig {
  constructor() {
    // Optional explicit mode selection: oauth2 | oauth1 | app (auto when empty)
    this.authModeSetting = getenv('X_AUTH_MODE', '').trim().toLowerCase();

    // OAuth 2.0 user context
    // X_OAUTH2_ACCESS_TOKEN is the explicit variable; X_ACCESS_TOKEN without
    // X_ACCESS_TOKEN_SECRET is also treated as an OAuth 2.0 user token.
    this.oauth2AccessToken = getenv('X_OAUTH2_ACCESS_TOKEN', '');
    // Client ID/secret are only used to obtain/refresh OAuth 2.0 tokens.
    this.clientId = getenv('X_CLIENT_ID', '');
    this.clientSecret = getenv('X_CLIENT_SECRET', '');

    // OAuth 1.0a user context
    this.apiKey = getenv('X_API_KEY', '');
    this.apiKeySecret = getenv('X_API_KEY_SECRET', '');
    this.accessToken = getenv('X_ACCESS_TOKEN', '');
    this.accessTokenSecret = getenv('X_ACCESS_TOKEN_SECRET', '');

    // Application-only bearer token (read-only)
    this.bearerToken = getenv('X_BEARER_TOKEN', '');

    this.logLevel = getenv('LOG_LEVEL', 'info');
  }

  /** OAuth 2.0 user token, if any */
  get oauth2UserToken() {
    if (this.oauth2AccessToken) return this.oauth2AccessToken;
    if (this.accessToken && !this.accessTokenSecret) return this.accessToken;
    return '';
  }

  get hasOAuth2UserAuth() {
    return !!this.oauth2UserToken;
  }

  get hasOAuth1UserAuth() {
    return !!(this.apiKey && this.apiKeySecret && this.accessToken && this.accessTokenSecret);
  }

  /** Any OAuth 1.0a-specific value is present */
  get hasAnyOAuth1Value() {
    return !!(this.apiKey || this.apiKeySecret || this.accessTokenSecret);
  }

  get hasUserAuth() {
    return this.hasOAuth2UserAuth || this.hasOAuth1UserAuth;
  }

  get hasBearerAuth() {
    return !!this.bearerToken;
  }

  /** Explicitly requested mode, normalized (null when automatic) */
  get requestedMode() {
    if (!this.authModeSetting || this.authModeSetting === 'auto') return null;
    return MODE_ALIASES[this.authModeSetting] || 'invalid';
  }

  /**
   * Resolve the authentication mode.
   * Automatic priority: complete OAuth 1.0a > OAuth 2.0 user token > app-only bearer.
   * @returns {string|null}
   */
  get authMode() {
    const requested = this.requestedMode;
    if (requested === 'invalid') return null;
    if (requested === 'oauth1') return this.hasOAuth1UserAuth ? 'oauth1' : null;
    if (requested === 'oauth2') return this.hasOAuth2UserAuth ? 'oauth2' : null;
    if (requested === 'app') return this.hasBearerAuth ? 'app' : null;

    if (this.hasOAuth1UserAuth) return 'oauth1';
    // Incomplete OAuth 1.0a credentials are an error unless an explicit OAuth 2.0 token exists
    if (this.hasAnyOAuth1Value && !this.oauth2AccessToken) return null;
    if (this.hasOAuth2UserAuth) return 'oauth2';
    if (this.hasBearerAuth) return 'app';
    return null;
  }

  oauth1MissingFields() {
    const missing = [];
    if (!this.apiKey) missing.push('X_API_KEY');
    if (!this.apiKeySecret) missing.push('X_API_KEY_SECRET');
    if (!this.accessToken) missing.push('X_ACCESS_TOKEN');
    if (!this.accessTokenSecret) missing.push('X_ACCESS_TOKEN_SECRET');
    return missing;
  }

  /**
   * Validate X.com configuration
   * @returns {object} Object with errors array
   */
  validate() {
    const errors = [];
    const requested = this.requestedMode;

    if (requested === 'invalid') {
      errors.push(`Invalid X_AUTH_MODE "${this.authModeSetting}" (expected: oauth2, oauth1, app or auto)`);
      return { errors };
    }

    if (requested === 'oauth1' && !this.hasOAuth1UserAuth) {
      errors.push(`OAuth 1.0a user auth requires: ${this.oauth1MissingFields().join(', ')}`);
    } else if (requested === 'oauth2' && !this.hasOAuth2UserAuth) {
      errors.push('OAuth 2.0 user auth requires X_OAUTH2_ACCESS_TOKEN (or X_ACCESS_TOKEN without X_ACCESS_TOKEN_SECRET)');
    } else if (requested === 'app' && !this.hasBearerAuth) {
      errors.push('App-only auth requires X_BEARER_TOKEN');
    } else if (!requested && !this.authMode) {
      if (this.hasAnyOAuth1Value) {
        errors.push(`Incomplete OAuth 1.0a credentials, missing: ${this.oauth1MissingFields().join(', ')}`);
      } else {
        errors.push('At least one authentication method is required: OAuth 2.0 user token (X_OAUTH2_ACCESS_TOKEN), OAuth 1.0a (X_API_KEY + X_API_KEY_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET), or app-only bearer token (X_BEARER_TOKEN, read-only)');
      }
    }

    return { errors };
  }

  get isValid() {
    return this.validate().errors.length === 0;
  }
}

/**
 * X.com broadcaster implementation
 */
export class XBroadcaster {
  /**
   * @param {object} [options]
   * @param {Function} [options.ApiClient] - SDK client constructor (injectable for tests)
   */
  constructor(options = {}) {
    this.name = 'x';
    this.displayName = 'X.com';
    this.ApiClient = options.ApiClient || TwitterApi;

    this.config = new XConfig();
    this.logger = new Logger(this.config.logLevel);

    this.client = null;
    this.authMode = null;
    this.authMethod = 'None';
    this.initializeClient();
  }

  /** Whether the configured credentials can publish (user context only) */
  get canPost() {
    return this.authMode === 'oauth1' || this.authMode === 'oauth2';
  }

  /**
   * Initialize the SDK client for the resolved authentication mode
   */
  initializeClient() {
    const mode = this.config.authMode;
    try {
      if (mode === 'oauth1') {
        this.client = new this.ApiClient({
          appKey: this.config.apiKey,
          appSecret: this.config.apiKeySecret,
          accessToken: this.config.accessToken,
          accessSecret: this.config.accessTokenSecret,
        });
      } else if (mode === 'oauth2') {
        // OAuth 2.0 user access token is sent as a bearer token
        this.client = new this.ApiClient(this.config.oauth2UserToken);
      } else if (mode === 'app') {
        this.client = new this.ApiClient(this.config.bearerToken);
      } else {
        this.logger.debug('No valid X.com authentication method configured');
        this.client = null;
        this.authMode = null;
        this.authMethod = 'None';
        return;
      }
      this.authMode = mode;
      this.authMethod = AUTH_METHOD_LABELS[mode];
      this.logger.debug(`X.com client initialized with ${this.authMethod} authentication`);
    } catch (error) {
      this.logger.error('Failed to initialize X.com client:', error.message);
      this.client = null;
      this.authMode = null;
      this.authMethod = 'None';
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
   * Send tweet to X.com with rate limit handling
   */
  async send(message, maxRetries = 10) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Posting tweet to X.com using ${this.authMethod} (attempt ${attempt}/${maxRetries})`);
        
        if (!this.client) {
          throw new Error('X.com client not initialized - check authentication credentials');
        }

        // Check if bearer token is being used (which has limited posting capabilities)
        if (this.authMode === 'app') {
          throw new Error('App-only bearer token cannot post tweets - OAuth 2.0 or OAuth 1.0a user authentication required');
        }

        // Check if no authentication method was set
        if (!this.authMode) {
          throw new Error('No valid authentication method configured for X.com');
        }
        
        const result = await this.client.v2.tweet(message);

        // Validate the response to ensure tweet was actually created
        if (!result || !result.data || !result.data.id) {
          throw new Error('Invalid response from X.com API - tweet may not have been created');
        }

        this.logger.info('✅ Tweet posted to X.com successfully');
        return {
          success: true,
          platform: this.name,
          result: result,
          messageId: result.data.id,  // Return the tweet ID for potential deletion
          method: this.authMethod
        };
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          // Try to extract rate limit reset time from error response
          const resetTime = this.extractRateLimitResetTime(error);
          let waitTime;
          
          if (resetTime) {
            // Use the actual reset time from API response
            const now = Math.floor(Date.now() / 1000); // Current time in seconds
            waitTime = Math.max((resetTime - now) * 1000, 1000); // Convert to ms, minimum 1s
            this.logger.warn(`🕰️ Rate limit hit (429). API reset at ${new Date(resetTime * 1000).toLocaleTimeString()}. Waiting ${Math.ceil(waitTime/1000)}s...`);
          } else {
            // Fallback to exponential backoff if no reset time available
            waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s, etc.
            this.logger.warn(`🔄 Rate limit hit (429). Using exponential backoff: waiting ${waitTime/1000}s before retry ${attempt}/${maxRetries}...`);
          }
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            this.logger.error('❌ Rate limit exceeded max retries for posting tweet');
            return {
              success: false,
              platform: this.name,
              error: `Rate limit exceeded after ${maxRetries} attempts: ${error.message}`
            };
          }
        } else {
          // Non-rate-limit error, don't retry
          this.logger.error('Failed to post X.com tweet:', error.message);
          // Log additional error details for debugging
          if (error.response) {
            this.logger.debug('Error response:', JSON.stringify(error.response, null, 2));
          }
          if (error.data) {
            this.logger.debug('Error data:', JSON.stringify(error.data, null, 2));
          }
          return {
            success: false,
            platform: this.name,
            error: this.describeAuthError(error)
          };
        }
      }
    }
  }

  /**
   * Delete tweet from X.com with rate limit handling
   */
  async deleteMessage(tweetId, maxRetries = 10) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Deleting tweet from X.com: ${tweetId} (attempt ${attempt}/${maxRetries})`);
        
        if (!this.client) {
          throw new Error('X.com client not initialized - check authentication credentials');
        }

        // Check if bearer token is being used (which cannot delete tweets)
        if (this.authMode === 'app') {
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
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          // Try to extract rate limit reset time from error response
          const resetTime = this.extractRateLimitResetTime(error);
          let waitTime;
          
          if (resetTime) {
            // Use the actual reset time from API response
            const now = Math.floor(Date.now() / 1000); // Current time in seconds
            waitTime = Math.max((resetTime - now) * 1000, 1000); // Convert to ms, minimum 1s
            this.logger.warn(`🕰️ Rate limit hit (429). API reset at ${new Date(resetTime * 1000).toLocaleTimeString()}. Waiting ${Math.ceil(waitTime/1000)}s...`);
          } else {
            // Fallback to exponential backoff if no reset time available
            waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s, etc.
            this.logger.warn(`🔄 Rate limit hit (429). Using exponential backoff: waiting ${waitTime/1000}s before retry ${attempt}/${maxRetries}...`);
          }
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            this.logger.error('❌ Rate limit exceeded max retries for deleting tweet');
            return {
              success: false,
              platform: this.name,
              error: `Rate limit exceeded after ${maxRetries} attempts: ${error.message}`
            };
          }
        } else {
          // Non-rate-limit error, don't retry
          this.logger.error('Failed to delete X.com tweet:', error.message);
          return {
            success: false,
            platform: this.name,
            error: error.message
          };
        }
      }
    }
  }

  /**
   * Extract rate limit reset time from X.com API error response
   * @param {Error} error - The error object from the API call
   * @returns {number|null} - Unix timestamp when rate limit resets, or null if not found
   */
  extractRateLimitResetTime(error) {
    try {
      // Check if error has response data with headers
      if (error.response && error.response.headers) {
        const headers = error.response.headers;
        
        // X.com API returns rate limit info in these headers:
        // x-rate-limit-reset: Unix timestamp when limit resets
        // x-rate-limit-remaining: Number of requests remaining
        const resetHeader = headers['x-rate-limit-reset'] || headers['X-Rate-Limit-Reset'];
        
        if (resetHeader) {
          const resetTime = parseInt(resetHeader, 10);
          if (!isNaN(resetTime) && resetTime > 0) {
            this.logger.debug(`Found rate limit reset time: ${resetTime} (${new Date(resetTime * 1000).toISOString()})`);
            return resetTime;
          }
        }
      }
      
      // Check if error has data property (different error structure)
      if (error.data && error.data.headers) {
        const resetHeader = error.data.headers['x-rate-limit-reset'] || error.data.headers['X-Rate-Limit-Reset'];
        if (resetHeader) {
          const resetTime = parseInt(resetHeader, 10);
          if (!isNaN(resetTime) && resetTime > 0) {
            this.logger.debug(`Found rate limit reset time in data: ${resetTime}`);
            return resetTime;
          }
        }
      }
      
      // Try to parse from error message if it contains reset time
      const resetMatch = error.message.match(/reset.*?(\d{10})/i);
      if (resetMatch) {
        const resetTime = parseInt(resetMatch[1], 10);
        if (!isNaN(resetTime) && resetTime > 0) {
          this.logger.debug(`Extracted reset time from error message: ${resetTime}`);
          return resetTime;
        }
      }
      
      this.logger.debug('No rate limit reset time found in error response');
      return null;
    } catch (parseError) {
      this.logger.debug('Error parsing rate limit reset time:', parseError.message);
      return null;
    }
  }

  /**
   * Validate message for X.com constraints
   * @param {string} message - The message to validate
   * @returns {object} Object with isValid boolean and errors array
   */
  validateMessage(message) {
    const errors = [];
    const MAX_TWEET_LENGTH = 280;

    if (!message || typeof message !== 'string') {
      errors.push('Message must be a non-empty string');
      return { isValid: false, errors };
    }

    if (message.length > MAX_TWEET_LENGTH) {
      errors.push(`Message is too long for X.com: ${message.length} characters (max ${MAX_TWEET_LENGTH})`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Describe identity/permission errors accurately
   */
  describeAuthError(error) {
    const code = error?.code ?? error?.response?.statusCode;
    if (code === 401) {
      return `${this.authMethod} credentials were rejected (401 Unauthorized): ${error.message}`;
    }
    if (code === 403) {
      return `${this.authMethod} lacks permission (403 Forbidden) - check app permissions/scopes (OAuth 2.0 needs tweet.read, tweet.write, users.read): ${error.message}`;
    }
    return error.message;
  }

  /**
   * Read-only connectivity check (never publishes)
   */
  async checkConnection() {
    return this.test();
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

      // App-only bearer tokens have no user identity and cannot post
      if (this.authMode === 'app') {
        return {
          success: true,
          platform: this.name,
          canPost: false,
          message: 'X.com: App-only bearer token configured (read-only - cannot post/delete tweets)'
        };
      }

      // Read-only identity check for user context
      const userInfo = await this.client.v2.me();
      const username = userInfo?.data?.username;
      if (!username) {
        return {
          success: false,
          platform: this.name,
          message: `X.com: ${this.authMethod} identity check returned no user`
        };
      }

      return {
        success: true,
        platform: this.name,
        canPost: true,
        message: `X.com: Connection successful using ${this.authMethod} (authenticated as @${username})`
      };
    } catch (error) {
      return {
        success: false,
        platform: this.name,
        message: `X.com: ${this.describeAuthError(error)}`
      };
    }
  }
}

export default XBroadcaster;