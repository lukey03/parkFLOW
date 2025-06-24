import { dbManager } from './connection';
import { SchemaManager } from './schema';
import { GuildSettingsModel, ShiftModel, BreakModel, ActionModel } from './models';

export * from './connection';
export * from './schema';
export * from './models';

export class Database {
	private static initialized = false;
	private static schemaManager: SchemaManager;
	private static guildSettingsModel: GuildSettingsModel;
	private static shiftModel: ShiftModel;
	private static breakModel: BreakModel;
	private static actionModel: ActionModel;

	public static init(dbPath?: string): void {
		if (this.initialized) return;

		dbManager.connect(dbPath);

		this.schemaManager = new SchemaManager();
		this.schemaManager.initializeTables();

		this.guildSettingsModel = new GuildSettingsModel();
		this.shiftModel = new ShiftModel();
		this.breakModel = new BreakModel();
		this.actionModel = new ActionModel();

		this.initialized = true;
	}

	public static get guildSettings(): GuildSettingsModel {
		this.ensureInitialized();
		return this.guildSettingsModel;
	}

	public static get shifts(): ShiftModel {
		this.ensureInitialized();
		return this.shiftModel;
	}

	public static get breaks(): BreakModel {
		this.ensureInitialized();
		return this.breakModel;
	}

	public static get actions(): ActionModel {
		this.ensureInitialized();
		return this.actionModel;
	}

	public static get schema(): SchemaManager {
		this.ensureInitialized();
		return this.schemaManager;
	}

	private static ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('Database not initialized. Call Database.init() first.');
		}
	}

	public static close(): void {
		dbManager.close();
		this.initialized = false;
	}
}
