import type Database from 'better-sqlite3';
import { dbManager } from './connection';

export class SchemaManager {
	private db: Database.Database;

	constructor() {
		this.db = dbManager.getDatabase();
	}

	public initializeTables(): void {
		this.createGuildSettingsTable();
		this.createShiftsTable();
		this.createBreaksTable();
		this.createActionsTable();
	}

	private createGuildSettingsTable(): void {
		const createGuildSettingsTable = `
			CREATE TABLE IF NOT EXISTS guild_settings (
				guild_id TEXT PRIMARY KEY,
				action_logs_channel_id TEXT,
				shift_logs_channel_id TEXT,
				active_shift_channel_id TEXT,
				loa_request_channel_id TEXT,
				access_role_id TEXT,
				admin_role_id TEXT,
				created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
			)
		`;

		this.db.exec(createGuildSettingsTable);

		// Add the active_shift_channel_id column if it doesn't exist (for existing databases)
		try {
			this.db.exec('ALTER TABLE guild_settings ADD COLUMN active_shift_channel_id TEXT');
		} catch (error) {
			// Column already exists, ignore error
		}
	}

	private createShiftsTable(): void {
		const createShiftsTable = `
			CREATE TABLE IF NOT EXISTS shifts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				discord_id TEXT NOT NULL,
				guild_id TEXT NOT NULL,
				start_time INTEGER NOT NULL,
				end_time INTEGER,
				created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
			)
		`;

		this.db.exec(createShiftsTable);

		this.db.exec('CREATE INDEX IF NOT EXISTS idx_shifts_discord_id ON shifts(discord_id)');
		this.db.exec('CREATE INDEX IF NOT EXISTS idx_shifts_guild_id ON shifts(guild_id)');
	}

	private createBreaksTable(): void {
		const createBreaksTable = `
			CREATE TABLE IF NOT EXISTS breaks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				shift_id INTEGER NOT NULL,
				discord_id TEXT NOT NULL,
				guild_id TEXT NOT NULL,
				start_time INTEGER NOT NULL,
				end_time INTEGER,
				created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
			)
		`;

		this.db.exec(createBreaksTable);

		this.db.exec('CREATE INDEX IF NOT EXISTS idx_breaks_shift_id ON breaks(shift_id)');
		this.db.exec('CREATE INDEX IF NOT EXISTS idx_breaks_discord_id ON breaks(discord_id)');
		this.db.exec('CREATE INDEX IF NOT EXISTS idx_breaks_guild_id ON breaks(guild_id)');
	}

	private createActionsTable(): void {
		const createActionsTable = `
			CREATE TABLE IF NOT EXISTS actions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				discord_id TEXT NOT NULL,
				guild_id TEXT NOT NULL,
				action_type TEXT NOT NULL,
				description TEXT,
				start_date INTEGER NOT NULL,
				end_date INTEGER NOT NULL,
				is_completed BOOLEAN DEFAULT 0,
				completed_at INTEGER,
				created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
			)
		`;

		this.db.exec(createActionsTable);

		this.db.exec('CREATE INDEX IF NOT EXISTS idx_actions_discord_id ON actions(discord_id)');
		this.db.exec('CREATE INDEX IF NOT EXISTS idx_actions_guild_id ON actions(guild_id)');
		this.db.exec('CREATE INDEX IF NOT EXISTS idx_actions_end_date ON actions(end_date)');
	}

	public dropAllTables(): void {
		this.db.exec('DROP TABLE IF EXISTS actions');
		this.db.exec('DROP TABLE IF EXISTS breaks');
		this.db.exec('DROP TABLE IF EXISTS shifts');
		this.db.exec('DROP TABLE IF EXISTS guild_settings');
	}

	public getTableInfo(tableName: string): any[] {
		const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
		return stmt.all();
	}
}
