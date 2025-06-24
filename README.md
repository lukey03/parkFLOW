# parkFLOW

A Discord bot for shift logging and department action management designed for Clark County / Mayflower groups.

## Features

- **Shift Management**: Clock in/out with automatic time tracking
- **Break System**: Start and end breaks with duration tracking
- **Active Shift Display**: Real-time display of users currently on shift
- **Department Commands**: Administrative tools for managing shifts and actions
- **Action Logging**: Track departmental actions with automatic expiration
- **Server Configuration**: Per-server setup for channels and roles

## Commands

### Self Commands
- `/shift self toggle` - Clock in/out of shifts or start/end breaks
- `/shift self view` - View your logged time, last shift, or all shifts

### Department Commands (Admin Only)
- `/shift department adjust` - Modify user shift times or delete shifts
- `/shift department reset` - Clear weekly shift data
- `/shift department toggle` - Force toggle user shifts/breaks
- `/shift department view` - View department or specific user shifts

### Setup Commands
- `/server-setup` - Configure bot channels and roles for your server

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file at `src/.env`:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

3. Build and start:
   ```bash
   npm run build
   npm start
   ```

## Development

For development with auto-restart:
```bash
npm run watch:start
```

## Database

Uses SQLite with better-sqlite3 for local data persistence. Database automatically creates required tables on first run.

## Architecture

Built with the Sapphire Framework for Discord.js, featuring:
- Automatic command registration
- Role-based permissions
- Real-time shift tracking
- Periodic display updates
- Component-based UI (Discord Components v2)