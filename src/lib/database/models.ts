import type Database from 'better-sqlite3';
import { dbManager } from './connection';

export interface GuildSettings {
	guild_id: string;
	action_logs_channel_id?: string;
	shift_logs_channel_id?: string;
	active_shift_channel_id?: string;
	loa_request_channel_id?: string;
	access_role_id?: string;
	admin_role_id?: string;
	created_at: number;
	updated_at: number;
}

export interface Shift {
	id: number;
	discord_id: string;
	guild_id: string;
	start_time: number;
	end_time?: number;
	unit?: string;
	created_at: number;
	updated_at: number;
}

export interface Break {
	id: number;
	shift_id: number;
	discord_id: string;
	guild_id: string;
	start_time: number;
	end_time?: number;
	created_at: number;
	updated_at: number;
}

export interface Action {
	id: number;
	discord_id: string;
	guild_id: string;
	action_type: string;
	description?: string;
	start_date: number;
	end_date: number;
	is_completed: boolean;
	completed_at?: number;
	created_at: number;
	updated_at: number;
}

export class GuildSettingsModel {
	private db: Database.Database;

	constructor() {
		this.db = dbManager.getDatabase();
	}

	public create(guildId: string, settings: Partial<Omit<GuildSettings, 'guild_id' | 'created_at' | 'updated_at'>> = {}): GuildSettings {
		const stmt = this.db.prepare(`
			INSERT INTO guild_settings (guild_id, action_logs_channel_id, shift_logs_channel_id, active_shift_channel_id, loa_request_channel_id, access_role_id, admin_role_id)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		stmt.run(
			guildId,
			settings.action_logs_channel_id,
			settings.shift_logs_channel_id,
			settings.active_shift_channel_id,
			settings.loa_request_channel_id,
			settings.access_role_id,
			settings.admin_role_id
		);
		return this.findByGuildId(guildId)!;
	}

	public findByGuildId(guildId: string): GuildSettings | null {
		const stmt = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
		return stmt.get(guildId) as GuildSettings | null;
	}

	public update(guildId: string, updates: Partial<Omit<GuildSettings, 'guild_id' | 'created_at'>>): GuildSettings | null {
		// Security: Only allow updates to specific columns to prevent SQL injection
		const allowedFields = new Set([
			'action_logs_channel_id',
			'shift_logs_channel_id',
			'active_shift_channel_id',
			'loa_request_channel_id',
			'access_role_id',
			'admin_role_id',
			'updated_at'
		]);

		const fields = Object.keys(updates).filter((key) => key !== 'guild_id' && key !== 'created_at' && allowedFields.has(key));

		if (fields.length === 0) return this.findByGuildId(guildId);

		const setClause = fields.map((field) => `${field} = ?`).join(', ');
		const values = fields.map((field) => updates[field as keyof typeof updates]);

		const stmt = this.db.prepare(`
			UPDATE guild_settings 
			SET ${setClause}, updated_at = strftime('%s', 'now')
			WHERE guild_id = ?
		`);

		stmt.run(...values, guildId);
		return this.findByGuildId(guildId);
	}

	public getAllWithActiveShiftChannel(): GuildSettings[] {
		const stmt = this.db.prepare('SELECT * FROM guild_settings WHERE active_shift_channel_id IS NOT NULL');
		return stmt.all() as GuildSettings[];
	}
}

export class ShiftModel {
	private db: Database.Database;

	constructor() {
		this.db = dbManager.getDatabase();
	}

	public startShift(discordId: string, guildId: string, unit?: string): Shift {
		const stmt = this.db.prepare(`
			INSERT INTO shifts (discord_id, guild_id, start_time, unit)
			VALUES (?, ?, ?, ?)
		`);

		const startTime = Math.floor(Date.now() / 1000);
		const result = stmt.run(discordId, guildId, startTime, unit);
		return this.findById(result.lastInsertRowid as number)!;
	}

	public endShift(id: number): Shift | null {
		const shift = this.findById(id);
		if (!shift || shift.end_time) {
			return null;
		}

		const endTime = Math.floor(Date.now() / 1000);

		const stmt = this.db.prepare(`
			UPDATE shifts 
			SET end_time = ?, updated_at = strftime('%s', 'now')
			WHERE id = ?
		`);

		stmt.run(endTime, id);
		return this.findById(id);
	}

	public findById(id: number): Shift | null {
		const stmt = this.db.prepare('SELECT * FROM shifts WHERE id = ?');
		return stmt.get(id) as Shift | null;
	}

	public findByDiscordId(discordId: string, guildId: string, limit?: number): Shift[] {
		const query = limit
			? 'SELECT * FROM shifts WHERE discord_id = ? AND guild_id = ? ORDER BY start_time DESC LIMIT ?'
			: 'SELECT * FROM shifts WHERE discord_id = ? AND guild_id = ? ORDER BY start_time DESC';

		const stmt = this.db.prepare(query);
		const params = limit ? [discordId, guildId, limit] : [discordId, guildId];
		return stmt.all(...params) as Shift[];
	}

	public findActiveShift(discordId: string, guildId: string): Shift | null {
		const stmt = this.db.prepare(`
			SELECT * FROM shifts 
			WHERE discord_id = ? AND guild_id = ? AND end_time IS NULL 
			ORDER BY start_time DESC 
			LIMIT 1
		`);
		return stmt.get(discordId, guildId) as Shift | null;
	}

	public findActiveShifts(guildId: string, unit?: string): Shift[] {
		let query = `
			SELECT * FROM shifts 
			WHERE guild_id = ? AND end_time IS NULL
		`;
		const params: any[] = [guildId];

		if (unit) {
			query += ` AND unit = ?`;
			params.push(unit);
		}

		query += ` ORDER BY start_time ASC`;
		const stmt = this.db.prepare(query);
		return stmt.all(...params) as Shift[];
	}

	public getTotalSeconds(discordId: string, guildId: string, startDate?: number, endDate?: number): number {
		let query = `
			SELECT SUM(
				CASE 
					WHEN end_time IS NOT NULL THEN end_time - start_time
					ELSE 0
				END
			) as total 
			FROM shifts 
			WHERE discord_id = ? AND guild_id = ?
		`;
		const params: any[] = [discordId, guildId];

		if (startDate) {
			query += ' AND start_time >= ?';
			params.push(startDate);
		}

		if (endDate) {
			query += ' AND start_time <= ?';
			params.push(endDate);
		}

		const stmt = this.db.prepare(query);
		const result = stmt.get(...params) as { total: number | null };
		return result.total || 0;
	}

	public getShiftDuration(shift: Shift): number {
		if (!shift.end_time) {
			return Math.floor(Date.now() / 1000) - shift.start_time;
		}
		return shift.end_time - shift.start_time;
	}

	public getEffectiveShiftDuration(shift: Shift, breakModel: BreakModel): number {
		const totalShiftTime = this.getShiftDuration(shift);
		const totalBreakTime = breakModel.getTotalBreakTimeForShift(shift.id);
		return Math.max(0, totalShiftTime - totalBreakTime);
	}

	public delete(id: number): boolean {
		const breakModel = new BreakModel();
		breakModel.deleteByShiftId(id);

		const stmt = this.db.prepare('DELETE FROM shifts WHERE id = ?');
		const result = stmt.run(id);
		return result.changes > 0;
	}

	public cleanupOldShifts(): number {
		const tenWeeksAgo = Math.floor(Date.now() / 1000) - 10 * 7 * 24 * 60 * 60;
		const stmt = this.db.prepare('DELETE FROM shifts WHERE start_time < ?');
		const result = stmt.run(tenWeeksAgo);
		return result.changes;
	}

	public getShiftsByGuild(guildId: string, limit?: number): Shift[] {
		const query = limit
			? 'SELECT * FROM shifts WHERE guild_id = ? ORDER BY start_time DESC LIMIT ?'
			: 'SELECT * FROM shifts WHERE guild_id = ? ORDER BY start_time DESC';

		const stmt = this.db.prepare(query);
		const params = limit ? [guildId, limit] : [guildId];
		return stmt.all(...params) as Shift[];
	}

	public getShiftsByWeek(guildId: string, weekOffset = 0): Shift[] {
		const now = new Date();
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - now.getDay() + weekOffset * 7);
		startOfWeek.setHours(0, 0, 0, 0);

		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 7);

		const startTimestamp = Math.floor(startOfWeek.getTime() / 1000);
		const endTimestamp = Math.floor(endOfWeek.getTime() / 1000);

		const stmt = this.db.prepare(`
			SELECT * FROM shifts 
			WHERE guild_id = ? AND start_time >= ? AND start_time < ? 
			ORDER BY start_time DESC
		`);
		return stmt.all(guildId, startTimestamp, endTimestamp) as Shift[];
	}

	public clearWeeklyShifts(guildId: string): number {
		const currentWeekShifts = this.getShiftsByWeek(guildId, 0);

		if (currentWeekShifts.length === 0) return 0;

		if (currentWeekShifts.length > 1000) {
			throw new Error('Too many shifts to delete in a single operation');
		}

		const shiftIds = currentWeekShifts.map((shift) => shift.id);
		const breakModel = new BreakModel();

		for (const id of shiftIds) {
			breakModel.deleteByShiftId(id);
		}

		const placeholders = shiftIds.map(() => '?').join(',');
		const stmt = this.db.prepare(`DELETE FROM shifts WHERE id IN (${placeholders})`);
		const result = stmt.run(...shiftIds);
		return result.changes;
	}

	public adjustShiftTime(id: number, adjustmentSeconds: number): Shift | null {
		const shift = this.findById(id);
		if (!shift || !shift.end_time) return null;

		const MAX_ADJUSTMENT = 7 * 24 * 60 * 60;
		if (Math.abs(adjustmentSeconds) > MAX_ADJUSTMENT) {
			throw new Error('Adjustment too large - maximum 7 days');
		}

		const newEndTime = Math.max(shift.start_time, shift.end_time + adjustmentSeconds);

		const currentTime = Math.floor(Date.now() / 1000);
		const oneYearFromNow = currentTime + 365 * 24 * 60 * 60;
		if (newEndTime > oneYearFromNow) {
			throw new Error('Resulting time is unreasonably far in the future');
		}

		const stmt = this.db.prepare(`
			UPDATE shifts 
			SET end_time = ?, updated_at = strftime('%s', 'now')
			WHERE id = ?
		`);

		stmt.run(newEndTime, id);
		return this.findById(id);
	}

	public getShiftsByUnit(guildId: string, unit: string, limit?: number): Shift[] {
		const query = limit
			? 'SELECT * FROM shifts WHERE guild_id = ? AND unit = ? ORDER BY start_time DESC LIMIT ?'
			: 'SELECT * FROM shifts WHERE guild_id = ? AND unit = ? ORDER BY start_time DESC';

		const stmt = this.db.prepare(query);
		const params = limit ? [guildId, unit, limit] : [guildId, unit];
		return stmt.all(...params) as Shift[];
	}

	public getUnitsByGuild(guildId: string): string[] {
		const stmt = this.db.prepare(`
			SELECT DISTINCT unit FROM shifts 
			WHERE guild_id = ? AND unit IS NOT NULL 
			ORDER BY unit ASC
		`);
		const results = stmt.all(guildId) as { unit: string }[];
		return results.map((row) => row.unit);
	}
}

export class BreakModel {
	private db: Database.Database;

	constructor() {
		this.db = dbManager.getDatabase();
	}

	public startBreak(shiftId: number, discordId: string, guildId: string): Break {
		const stmt = this.db.prepare(`
			INSERT INTO breaks (shift_id, discord_id, guild_id, start_time)
			VALUES (?, ?, ?, ?)
		`);

		const startTime = Math.floor(Date.now() / 1000);
		const result = stmt.run(shiftId, discordId, guildId, startTime);
		return this.findById(result.lastInsertRowid as number)!;
	}

	public endBreak(id: number): Break | null {
		const breakRecord = this.findById(id);
		if (!breakRecord || breakRecord.end_time) {
			return null;
		}

		const endTime = Math.floor(Date.now() / 1000);

		const stmt = this.db.prepare(`
			UPDATE breaks 
			SET end_time = ?, updated_at = strftime('%s', 'now')
			WHERE id = ?
		`);

		stmt.run(endTime, id);
		return this.findById(id);
	}

	public findById(id: number): Break | null {
		const stmt = this.db.prepare('SELECT * FROM breaks WHERE id = ?');
		return stmt.get(id) as Break | null;
	}

	public findByShiftId(shiftId: number): Break[] {
		const stmt = this.db.prepare('SELECT * FROM breaks WHERE shift_id = ? ORDER BY start_time DESC');
		return stmt.all(shiftId) as Break[];
	}

	public findActiveBreak(discordId: string, guildId: string): Break | null {
		const stmt = this.db.prepare(`
			SELECT * FROM breaks 
			WHERE discord_id = ? AND guild_id = ? AND end_time IS NULL 
			ORDER BY start_time DESC 
			LIMIT 1
		`);
		return stmt.get(discordId, guildId) as Break | null;
	}

	public getBreakDuration(breakRecord: Break): number {
		if (!breakRecord.end_time) {
			return Math.floor(Date.now() / 1000) - breakRecord.start_time;
		}
		return breakRecord.end_time - breakRecord.start_time;
	}

	public getTotalBreakTimeForShift(shiftId: number): number {
		const stmt = this.db.prepare(`
			SELECT SUM(
				CASE 
					WHEN end_time IS NOT NULL THEN end_time - start_time
					ELSE 0
				END
			) as total 
			FROM breaks 
			WHERE shift_id = ?
		`);
		const result = stmt.get(shiftId) as { total: number | null };
		return result.total || 0;
	}

	public delete(id: number): boolean {
		const stmt = this.db.prepare('DELETE FROM breaks WHERE id = ?');
		const result = stmt.run(id);
		return result.changes > 0;
	}

	public deleteByShiftId(shiftId: number): number {
		const stmt = this.db.prepare('DELETE FROM breaks WHERE shift_id = ?');
		const result = stmt.run(shiftId);
		return result.changes;
	}
}

export class ActionModel {
	private db: Database.Database;

	constructor() {
		this.db = dbManager.getDatabase();
	}

	public create(actionData: Omit<Action, 'id' | 'created_at' | 'updated_at' | 'is_completed' | 'completed_at'>): Action {
		const stmt = this.db.prepare(`
			INSERT INTO actions (discord_id, guild_id, action_type, description, start_date, end_date)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		const result = stmt.run(
			actionData.discord_id,
			actionData.guild_id,
			actionData.action_type,
			actionData.description,
			actionData.start_date,
			actionData.end_date
		);
		return this.findById(result.lastInsertRowid as number)!;
	}

	public findById(id: number): Action | null {
		const stmt = this.db.prepare('SELECT * FROM actions WHERE id = ?');
		return stmt.get(id) as Action | null;
	}

	public findByDiscordId(discordId: string, guildId: string, includeCompleted = true): Action[] {
		const query = includeCompleted
			? 'SELECT * FROM actions WHERE discord_id = ? AND guild_id = ? ORDER BY start_date DESC'
			: 'SELECT * FROM actions WHERE discord_id = ? AND guild_id = ? AND is_completed = 0 ORDER BY start_date DESC';

		const stmt = this.db.prepare(query);
		return stmt.all(discordId, guildId) as Action[];
	}

	public findExpiredActions(guildId?: string): Action[] {
		const now = Math.floor(Date.now() / 1000);
		let query = `SELECT * FROM actions WHERE is_completed = 0 AND end_date <= ?`;
		const params: any[] = [now];

		if (guildId) {
			query += ` AND guild_id = ?`;
			params.push(guildId);
		}

		query += ` ORDER BY end_date ASC`;
		const stmt = this.db.prepare(query);
		return stmt.all(...params) as Action[];
	}

	public findByType(actionType: string, guildId: string, includeCompleted = true): Action[] {
		const query = includeCompleted
			? 'SELECT * FROM actions WHERE action_type = ? AND guild_id = ? ORDER BY start_date DESC'
			: 'SELECT * FROM actions WHERE action_type = ? AND guild_id = ? AND is_completed = 0 ORDER BY start_date DESC';

		const stmt = this.db.prepare(query);
		return stmt.all(actionType, guildId) as Action[];
	}

	public complete(id: number): Action | null {
		const stmt = this.db.prepare(`
			UPDATE actions 
			SET is_completed = 1, completed_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
			WHERE id = ?
		`);

		stmt.run(id);
		return this.findById(id);
	}

	public update(id: number, updates: Partial<Omit<Action, 'id' | 'created_at'>>): Action | null {
		// Security: Only allow updates to specific columns to prevent SQL injection
		const allowedFields = new Set([
			'discord_id',
			'guild_id',
			'action_type',
			'description',
			'start_date',
			'end_date',
			'is_completed',
			'completed_at',
			'updated_at'
		]);

		const fields = Object.keys(updates).filter((key) => key !== 'id' && key !== 'created_at' && allowedFields.has(key));

		if (fields.length === 0) return this.findById(id);

		const setClause = fields.map((field) => `${field} = ?`).join(', ');
		const values = fields.map((field) => updates[field as keyof typeof updates]);

		const stmt = this.db.prepare(`
			UPDATE actions 
			SET ${setClause}, updated_at = strftime('%s', 'now')
			WHERE id = ?
		`);

		stmt.run(...values, id);
		return this.findById(id);
	}

	public delete(id: number): boolean {
		const stmt = this.db.prepare('DELETE FROM actions WHERE id = ?');
		const result = stmt.run(id);
		return result.changes > 0;
	}

	public deleteAfterLogging(id: number): boolean {
		return this.delete(id);
	}

	public findAndDeleteExpiredActions(guildId?: string): Action[] {
		const expiredActions = this.findExpiredActions(guildId);

		if (expiredActions.length > 0) {
			if (expiredActions.length > 1000) {
				throw new Error('Too many expired actions to delete in a single operation');
			}

			const ids = expiredActions.map((action) => action.id);
			const placeholders = ids.map(() => '?').join(',');
			const stmt = this.db.prepare(`DELETE FROM actions WHERE id IN (${placeholders})`);
			stmt.run(...ids);
		}

		return expiredActions;
	}

	public getActionDurationDays(action: Action): number {
		return Math.ceil((action.end_date - action.start_date) / (24 * 60 * 60));
	}

	public getActionDurationSeconds(action: Action): number {
		return action.end_date - action.start_date;
	}
}
