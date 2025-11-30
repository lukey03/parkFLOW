# parkFLOW

A Discord bot for shift logging and department action management designed for law enforcement and emergency services departments.

## Features

- **Shift Management**: Clock in/out with automatic time tracking
- **Break System**: Start and end breaks with duration tracking
- **Active Shift Display**: Real-time display of employees currently on duty
- **Department Commands**: Administrative tools for managing shifts and actions
- **Action Logging**: Track departmental actions with automatic expiration
- **Server Configuration**: Per-server setup for channels and roles
- **Multi-Guild Support**: Works across multiple Discord servers simultaneously

## Commands

### Self Commands (Available to all staff)

- `/shift self toggle` - Clock in/out of shifts or start/end breaks
- `/shift self view` - View your logged time, last shift, or all shifts

### Department Commands (Admin Only)

- `/shift department adjust` - Modify user shift times or delete shifts
- `/shift department reset` - Clear biweekly shift data
- `/shift department toggle` - Force toggle user shifts/breaks
- `/shift department view` - View department or specific user shifts

### Setup Commands (Admin Only)

- `/server-setup` - Configure bot channels and roles for your server

## White-Label Customization

parkFLOW can be easily customized for different organizations by modifying the `config/branding.json` file. You can change:

- **Organization terminology** (employee, department, shift terms)
- **Unit/department names and codes**
- **Application branding and database names**
- **UI text and messages**

See [CONFIGURATION.md](CONFIGURATION.md) for detailed customization instructions and examples for police departments, fire departments, corporate security, and more.

## Installation & Setup

### Prerequisites

- Node.js (version 18 or higher)
- npm
- A Discord bot token

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/parkFLOW.git
cd parkFLOW
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configuration

#### Environment Setup

Create a `.env` file in the `src/` directory:

```env
DISCORD_TOKEN=your_bot_token_here
```

#### White-Label Setup (Optional)

Customize the `config/branding.json` file for your organization. The default configuration is set up for park/county services, but you can easily adapt it for police, fire, security, or any other service organization. See [CONFIGURATION.md](CONFIGURATION.md) for examples.

### 4. Build and Run

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm run build
npm start
```

#### Development with Auto-Restart

```bash
npm run watch:start
```

## Bot Setup in Discord

1. **Invite the bot** to your Discord server with the following permissions:

    - Send Messages
    - Use Slash Commands
    - Embed Links
    - Read Message History
    - Manage Messages

2. **Configure the bot** using `/server-setup` command to set:
    - Action logs channel
    - Shift logs channel
    - Active shift display channel
    - LOA request channel
    - Staff access role
    - Admin role

## Database

The bot uses SQLite with better-sqlite3 for local data persistence. The database file is automatically created in the `data/` directory on first run.

### Database Tables

- `guild_settings` - Per-server configuration (log channels, roles)
- `shifts` - Work shift tracking with automatic cleanup after 10 weeks
- `actions` - Timed departmental actions with automatic expiration
- `breaks` - Break tracking linked to shifts

## Architecture

Built with the [Sapphire Framework](https://github.com/sapphiredev/framework) for Discord.js, featuring:

- Automatic command registration and loading
- Role-based permissions system
- Real-time shift tracking with periodic updates
- Modern Discord UI components (ContainerBuilder/TextDisplayBuilder)
- Robust error handling and logging

## Development

### Project Structure

```
src/
├── commands/           # Slash commands and context menus
├── listeners/          # Event listeners
│   ├── commands/       # Command-related events
│   └── ready.ts        # Bot startup and initialization
├── lib/
│   ├── database/       # Database connection and models
│   ├── setup.ts        # Environment and framework setup
│   ├── constants.ts    # Application constants
│   ├── utils.ts        # Utility functions
│   └── tasks.ts        # Periodic task management
└── index.ts           # Main entry point
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Build and watch for changes
- `npm start` - Run in production mode
- `npm run dev` - Run in development mode
- `npm run watch:start` - Development with auto-restart
- `npm run format` - Format code with Prettier
- `npm run generate` - Generate new commands/listeners with Sapphire CLI

### Code Quality

The project uses:

- TypeScript with strict configuration
- Prettier for code formatting
- Sapphire's recommended configurations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate error handling.

## License

This project is licensed under the Unlicense - see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software. Credit to the original authors is appreciated but not required.

## Support

For issues, feature requests, or questions:

- Open an issue on GitHub

## Credits

Originally developed for Clark County / Mayflower groups (Primarily, Mayflower Parks and Wildlife, hence the name "parkFLOW"). Built with the Sapphire Framework and Discord.js.
