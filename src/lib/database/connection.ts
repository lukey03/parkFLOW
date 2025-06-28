import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { Config } from '../config';

class DatabaseManager {
	private static instance: DatabaseManager;
	private db: Database.Database | null = null;

	private constructor() {}

	public static getInstance(): DatabaseManager {
		if (!DatabaseManager.instance) {
			DatabaseManager.instance = new DatabaseManager();
		}
		return DatabaseManager.instance;
	}

	public connect(dbPath?: string): Database.Database {
		if (this.db) {
			return this.db;
		}

		try {
			const defaultPath = join(process.cwd(), 'data');
			const dbDirectory = dbPath ? join(process.cwd(), dbPath) : defaultPath;

			if (!existsSync(dbDirectory)) {
				mkdirSync(dbDirectory, { recursive: true });
			}

			const dbFile = join(dbDirectory, Config.app.database_filename);

			this.db = new Database(dbFile);
			this.db.pragma('journal_mode = WAL');
			this.db.pragma('synchronous = NORMAL');
			this.db.pragma('cache_size = 1000000');
			this.db.pragma('temp_store = MEMORY');

			return this.db;
		} catch (error) {
			console.error('Failed to connect to database. Please check file permissions and available disk space.');
			if (process.env.NODE_ENV === 'development') {
				console.error('Development error details:', error);
			}
			throw new Error('Database connection failed');
		}
	}

	public getDatabase(): Database.Database {
		if (!this.db) {
			throw new Error('Database not connected. Call connect() first.');
		}
		return this.db;
	}

	public close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}

export const dbManager = DatabaseManager.getInstance();
export default dbManager;
