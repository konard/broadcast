# Broadcast CLI Tool

A powerful CLI tool built with Bun.sh for broadcasting messages to multiple platforms simultaneously. Currently supports Telegram channels, VK walls, and X.com (Twitter).

## Features

- 🚀 **Fast & Modern**: Built with Bun.sh for lightning-fast execution
- 📱 **Multi-Platform**: Send to Telegram channels, VK walls, and X.com
- 🔧 **Configurable**: Environment-based configuration
- 🏗️ **Modular Architecture**: Separate broadcaster implementations for easy extensibility
- 📝 **Flexible**: Support for HTML formatting in Telegram
- 🧪 **Testing**: Built-in connectivity testing
- 🔍 **Logging**: Configurable logging levels
- ⚡ **CLI-Friendly**: Easy to use command-line interface with yargs
- 🤖 **Dual Telegram Auth**: Supports both Bot API and User Client authentication
- 🔐 **Session Management**: Automatic session persistence for user authentication

## Architecture

The tool follows a modular architecture with complete independence between components:
- **[`broadcast.mjs`](broadcast.mjs)** - Main CLI entry point using yargs
- **[`logger.mjs`](logger.mjs)** - Shared logging utility
- **[`telegram.mjs`](telegram.mjs)** - Telegram broadcaster with TelegramConfig class
- **[`vk.mjs`](vk.mjs)** - VK broadcaster with VKConfig class
- **[`x.mjs`](x.mjs)** - X.com broadcaster with XConfig class

Each broadcaster is completely independent and manages its own configuration using the `getenv` package. No shared configuration dependencies exist between platforms.

## Telegram Authentication

The Telegram broadcaster supports two authentication methods:

### Bot API Authentication (Recommended)
- **Use case**: Official channels, groups, automated posting
- **Setup**: Create bot via [@BotFather](https://t.me/botfather)
- **Requirements**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID`
- **Permissions**: Bot must be admin in target channel

### User Client Authentication (Advanced)
- **Use case**: Personal messaging, advanced Telegram features
- **Setup**: Create app at [my.telegram.org/apps](https://my.telegram.org/apps)
- **Requirements**: `TELEGRAM_USER_BOT_*` variables
- **Session**: Automatically managed with `.telegram_session` file
- **Interactive**: May prompt for phone verification on first run

The broadcaster automatically chooses the available method, preferring Bot API when both are configured.

## VK Support

The VK broadcaster supports both public groups and personal pages:

### For VK Groups (Communities):
```bash
VK_OWNER_ID=-123456789    # Negative group ID
VK_ACCESS_TOKEN=your_group_admin_token
```
- Requires admin rights to the group
- Posts appear on the group's wall
- Token needs `wall` scope

### For Personal Pages:
```bash
VK_OWNER_ID=123456789     # Positive user ID
VK_ACCESS_TOKEN=your_personal_token
```
- Posts to your personal wall
- Token needs `wall` scope for your account
- Must be a public profile for external posting

## X.com Support

The X.com broadcaster supports multiple authentication methods for maximum flexibility:

### OAuth 1.0a User Authentication (Standard)
```bash
X_API_KEY=your_api_key_here
X_API_KEY_SECRET=your_api_key_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```
- **Use case**: Standard user authentication, posting tweets
- **Capabilities**: Post tweets, delete tweets, full user functionality
- **Setup**: Create app at [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- **Note**: This matches the official X.com API terminology shown in the developer portal

### Bearer Token Authentication (Limited)
```bash
X_BEARER_TOKEN=your_bearer_token_here
```
- **Use case**: App-only authentication, read-only access
- **Capabilities**: Read-only operations, cannot post or delete tweets
- **Setup**: Generate from your Twitter app dashboard
- **Note**: Not suitable for broadcasting, mainly for testing connectivity

## Installation

### Prerequisites

- [Bun.sh](https://bun.sh) installed on your system
- Telegram Bot Token (create via [@BotFather](https://t.me/botfather))
- VK Access Token (create at [VK Developers](https://vk.com/dev))
- X.com API Credentials (create at [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard))

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Initialize your environment configuration**
   ```bash
   # Copy the example configuration
   cp .env.example .env
   
   # Alternative for Windows:
   # copy .env.example .env
   ```

4. **Edit `.env` file with your credentials**
   ```bash
   # Telegram Configuration
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHANNEL_ID=@yourchannel

   # VK Configuration  
   VK_ACCESS_TOKEN=your_vk_token_here
   VK_OWNER_ID=-123456789

   # X.com Configuration
   X_API_KEY=your_x_api_key_here
   X_API_KEY_SECRET=your_x_api_key_secret_here
   X_ACCESS_TOKEN=your_x_access_token_here
   X_ACCESS_TOKEN_SECRET=your_x_access_token_secret_here

   # Optional
   LOG_LEVEL=info
   ```

5. **Make the script executable (optional)**
   ```bash
   chmod +x broadcast.mjs
   ```

## Usage

### Basic Commands

**Send to all platforms (default):**
```bash
bun run broadcast.mjs send "Hello, World!"
```

**Send to specific platforms:**
```bash
# Telegram only
bun run broadcast.mjs send "Telegram message" --platforms telegram

# VK only
bun run broadcast.mjs send "VK message" --platforms vk

# X.com only
bun run broadcast.mjs send "X.com tweet" --platforms x

# Multiple platforms
bun run broadcast.mjs send "Multi-platform message" --platforms telegram,vk,x
```

**Verbose output:**
```bash
bun run broadcast.mjs send "Debug message" --verbose
```

**Test configuration:**
```bash
bun run broadcast.mjs test
```

### Command Reference

#### `send` command
Broadcast a message to specified platforms.

```bash
bun run broadcast.mjs send <message> [options]
```

**Arguments:**
- `<message>` - The message to broadcast (required)

**Options:**
- `-p, --platforms <platforms>` - Comma-separated platforms (telegram,vk,x,all) [default: all]
- `-v, --verbose` - Enable verbose logging
- `-h, --help` - Display help

#### `test` command
Test configuration and platform connectivity.

```bash
bun run broadcast.mjs test
```

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Bot Auth | Telegram bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_CHANNEL_ID` | Bot Auth | Channel username or ID | `@mychannel` or `-1001234567890` |
| `TELEGRAM_USER_BOT_API_ID` | User Auth | API ID from my.telegram.org/apps | `1234567` |
| `TELEGRAM_USER_BOT_API_HASH` | User Auth | API Hash from my.telegram.org/apps | `abc123def456...` |
| `TELEGRAM_USER_BOT_PHONE` | User Auth | Your phone number | `+1234567890` |
| `TELEGRAM_USER_BOT_CHAT_USERNAME` | User Auth | Target chat username | `@targetuser` |
| `TELEGRAM_USER_BOT_CHAT_ID` | User Auth | Target chat ID (alternative to username) | `123456789` |
| `VK_ACCESS_TOKEN` | Yes | VK access token | `abc123def456...` |
| `VK_OWNER_ID` | Yes | VK owner ID (negative for groups, positive for users) | `-123456789` or `123456789` |
| `X_API_KEY` | User Auth | X.com API key from developer portal | `your_api_key` |
| `X_API_KEY_SECRET` | User Auth | X.com API key secret from developer portal | `your_api_key_secret` |
| `X_ACCESS_TOKEN` | User Auth | X.com access token | `your_access_token` |
| `X_ACCESS_TOKEN_SECRET` | User Auth | X.com access token secret | `your_access_token_secret` |
| `X_BEARER_TOKEN` | App-only | X.com bearer token (limited functionality) | `your_bearer_token` |
| `LOG_LEVEL` | No | Logging level | `info` (default) |

### Getting Credentials

#### Telegram Setup

**Bot Authentication (Recommended):**
1. **Create a bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow instructions
   - Save the bot token

2. **Add bot to your channel:**
   - Add your bot to the target channel
   - Make it an admin with "Post Messages" permission
   - Get channel ID (use @userinfobot or check channel info)

**User Authentication (Advanced):**
1. **Create a Telegram application:**
   - Go to [my.telegram.org/apps](https://my.telegram.org/apps)
   - Create new application
   - Note the API ID and API Hash

2. **Configure user authentication:**
   - Set `TELEGRAM_USER_BOT_API_ID` and `TELEGRAM_USER_BOT_API_HASH`
   - Set `TELEGRAM_USER_BOT_PHONE` (your phone number)
   - Set target chat via `TELEGRAM_USER_BOT_CHAT_USERNAME` or `TELEGRAM_USER_BOT_CHAT_ID`

3. **First run setup:**
   - On first run, you'll be prompted for verification code
   - Session will be saved to `.telegram_session` file
   - Subsequent runs won't require re-authentication

#### VK Setup

1. **Create a VK application:**
   - Go to [VK Developers](https://vk.com/dev)
   - Create new app → Standalone application
   - Note the App ID

2. **Get access token:**
   - Use VK's OAuth or generate token with needed permissions
   - Required permissions: `wall` for posting to walls
   - For group walls, you need admin access to the group
   - The tool automatically uses the latest VK API version

3. **Get Owner ID:**
   - For groups: use negative group ID (e.g., `-123456789`)
   - For personal pages: use positive user ID (e.g., `123456789`)
   - Groups require admin access for wall posting

#### X.com Setup

1. **Create a Twitter Developer Account:**
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Apply for a developer account if you don't have one
   - Create a new project/app

2. **Generate API Credentials:**
   
   **For OAuth 1.0a User Authentication (Standard):**
   - In your app settings, ensure "Read and Write" permissions are enabled
   - Generate API Key and API Key Secret
   - Generate Access Token and Access Token Secret with read/write permissions  
   - Configure: `X_API_KEY`, `X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
   
   **For Bearer Token (Limited, Testing Only):**
   - Generate Bearer Token from app dashboard
   - Configure: `X_BEARER_TOKEN`
   - Note: Cannot post or delete tweets, read-only access

3. **Configure Permissions:**
   - Ensure your app has "Read and Write" permissions
   - For posting tweets, "Read and Write" is required
   - Bearer token apps have read-only access by default

4. **Authentication Notes:**
   - OAuth 1.0a is the standard authentication method shown in the developer portal
   - Bearer tokens are useful for read-only operations and testing connectivity
   - User authentication (OAuth 1.0a) is required for posting and deleting tweets

## Examples

### Simple Broadcasting
```bash
# Send to all platforms
bun run broadcast.mjs send "🎉 New product launch!"

# Send announcement to Telegram only
bun run broadcast.mjs send "📢 Important update" -p telegram
```

### HTML Formatting (Telegram)
```bash
bun run broadcast.mjs send "<b>Bold text</b> and <i>italic text</i>" -p telegram
```

### Testing Setup
```bash
# Test all configurations
bun run broadcast.mjs test

# Check with verbose output
bun run broadcast.mjs send "Test message" --verbose
```

## Troubleshooting

### Common Issues

**"Configuration errors" message:**
- Check if `.env` file exists and has correct values
- Ensure all required environment variables are set
- Run `bun run broadcast.mjs test` to validate setup

**"Telegram API error" message:**
- Verify bot token is correct
- Check if bot is added to the channel as admin
- Ensure channel ID is correct (with @ for usernames)

**"VK API error" message:**
- Verify access token has `wall` permissions
- Check if owner ID is correct (negative for groups, positive for users)
- Ensure you have admin rights for group posting

**"X.com API error" message:**
- Verify your API credentials are correct and active
- Check if your app has "Read and Write" permissions
- Ensure access tokens have the required permissions
- For Bearer token: Remember it's read-only and cannot post tweets
- Check if your developer account is in good standing

**"Failed to send" messages:**
- Check internet connectivity
- Verify API endpoints are accessible
- Try with verbose logging: `--verbose`

### Debug Mode

Enable debug logging for detailed information:
```bash
bun run broadcast.mjs send "Debug test" --verbose
```

Or set in environment:
```bash
export LOG_LEVEL=debug
bun run broadcast.mjs test
```

## Development

### Project Structure
```
broadcast/
├── broadcast.mjs      # Main CLI script (yargs-based)
├── logger.mjs         # Shared logging utility
├── telegram.mjs       # Telegram broadcaster (self-configured)
├── vk.mjs            # VK broadcaster (self-configured)
├── x.mjs             # X.com broadcaster (self-configured)
├── package.json       # Dependencies and scripts
├── .env.example       # Environment template
├── .env              # Your configuration (create from .env.example)
└── README.md         # This file
```

### Running in Development
```bash
# Install dependencies
bun install

# Run with file watching
bun run dev

# Direct execution
bun broadcast.mjs send "Development test"
```

## License

Unlicense - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
A tool to broadcast a message into different social networks
