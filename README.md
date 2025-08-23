# Broadcast CLI Tool

A powerful CLI tool built with Bun.sh for broadcasting messages to multiple platforms simultaneously. Currently supports Telegram channels and VK walls.

## Features

- 🚀 **Fast & Modern**: Built with Bun.sh for lightning-fast execution
- 📱 **Multi-Platform**: Send to Telegram channels and VK walls
- 🔧 **Configurable**: Environment-based configuration
- 🏗️ **Modular Architecture**: Separate broadcaster implementations for easy extensibility
- 📝 **Flexible**: Support for HTML formatting in Telegram
- 🧪 **Testing**: Built-in connectivity testing
- 🔍 **Logging**: Configurable logging levels
- ⚡ **CLI-Friendly**: Easy to use command-line interface with yargs

## Architecture

The tool follows a modular architecture with complete independence between components:
- **[`broadcast.mjs`](broadcast.mjs)** - Main CLI entry point using yargs
- **[`logger.mjs`](logger.mjs)** - Shared logging utility
- **[`telegram.mjs`](telegram.mjs)** - Telegram broadcaster with TelegramConfig class
- **[`vk.mjs`](vk.mjs)** - VK broadcaster with VKConfig class

Each broadcaster is completely independent and manages its own configuration using the `getenv` package. No shared configuration dependencies exist between platforms.

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

## Installation

### Prerequisites

- [Bun.sh](https://bun.sh) installed on your system
- Telegram Bot Token (create via [@BotFather](https://t.me/botfather))
- VK Access Token (create at [VK Developers](https://vk.com/dev))

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file with your credentials**
   ```bash
   # Telegram Configuration
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHANNEL_ID=@yourchannel

   # VK Configuration  
   VK_ACCESS_TOKEN=your_vk_token_here
   VK_OWNER_ID=-123456789
   VK_API_VERSION=5.131

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

# Multiple platforms
bun run broadcast.mjs send "Multi-platform message" --platforms telegram,vk
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
- `-p, --platforms <platforms>` - Comma-separated platforms (telegram,vk,all) [default: all]
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
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_CHANNEL_ID` | Yes | Channel username or ID | `@mychannel` or `-1001234567890` |
| `VK_ACCESS_TOKEN` | Yes | VK access token | `abc123def456...` |
| `VK_OWNER_ID` | Yes | VK owner ID (negative for groups, positive for users) | `-123456789` or `123456789` |
| `VK_API_VERSION` | No | VK API version | `5.131` (default) |
| `LOG_LEVEL` | No | Logging level | `info` (default) |

### Getting Credentials

#### Telegram Setup

1. **Create a bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow instructions
   - Save the bot token

2. **Add bot to your channel:**
   - Add your bot to the target channel
   - Make it an admin with "Post Messages" permission
   - Get channel ID (use @userinfobot or check channel info)

#### VK Setup

1. **Create a VK application:**
   - Go to [VK Developers](https://vk.com/dev)
   - Create new app → Standalone application
   - Note the App ID

2. **Get access token:**
   - Use VK's OAuth or generate token with needed permissions
   - Required permissions: `wall` for posting to walls
   - For group walls, you need admin access to the group

3. **Get Owner ID:**
   - For groups: use negative group ID (e.g., `-123456789`)
   - For personal pages: use positive user ID (e.g., `123456789`)
   - Groups require admin access for wall posting

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
