import type { SapphireClient } from '@sapphire/framework';
import { Database } from './database';
import { ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize, TextChannel } from 'discord.js';

export class TaskManager {
	private static instance: TaskManager;
	private activeShiftUpdateInterval: NodeJS.Timeout | null = null;
	private client: SapphireClient | null = null;

	private constructor() {}

	public static getInstance(): TaskManager {
		if (!TaskManager.instance) {
			TaskManager.instance = new TaskManager();
		}
		return TaskManager.instance;
	}

	public setClient(client: SapphireClient): void {
		this.client = client;
	}

	public startPeriodicTasks(): void {
		this.startActiveShiftUpdates();
	}

	public async updateActiveShiftDisplayForGuild(guildId: string): Promise<void> {
		await this.updateActiveShiftDisplay(guildId);
	}

	public stopPeriodicTasks(): void {
		if (this.activeShiftUpdateInterval) {
			clearInterval(this.activeShiftUpdateInterval);
			this.activeShiftUpdateInterval = null;
		}
	}

	private startActiveShiftUpdates(): void {
		this.activeShiftUpdateInterval = setInterval(
			async () => {
				await this.updateAllActiveShiftDisplays();
			},
			3 * 60 * 1000
		); // Update every 3 minutes
	}

	private async updateAllActiveShiftDisplays(): Promise<void> {
		try {
			if (!this.client) return;

			const allGuildSettings = Database.guildSettings.getAllWithActiveShiftChannel();

			for (const guildSettings of allGuildSettings) {
				await this.updateActiveShiftDisplay(guildSettings.guild_id);
			}
		} catch (error) {
			this.client?.logger.error('Error updating active shift displays:', error);
		}
	}

	private async updateActiveShiftDisplay(guildId: string): Promise<void> {
		try {
			if (!this.client) return;

			const guildSettings = Database.guildSettings.findByGuildId(guildId);
			if (!guildSettings?.active_shift_channel_id) {
				return;
			}

			const channel = await this.client.channels.fetch(guildSettings.active_shift_channel_id);
			if (!channel?.isTextBased()) {
				return;
			}

			const activeShifts = Database.shifts.findActiveShifts(guildId);

			if (activeShifts.length === 0) {
				const container = this.buildContainer('## 🕐 Active Shifts', '_No employees are currently active in the County._');
				await this.sendOrUpdateActiveShiftMessage(channel as TextChannel, container);
				return;
			}

			const shiftLines: string[] = [];
			const currentTime = Math.floor(Date.now() / 1000);

			for (const shift of activeShifts) {
				try {
					const guild = await this.client.guilds.fetch(guildId);
					const member = await guild.members.fetch(shift.discord_id);
					const displayName = member.displayName;
					const shiftDuration = currentTime - shift.start_time;
					const durationStr = this.formatDurationString(shiftDuration);
					const activeBreak = Database.breaks.findActiveBreak(shift.discord_id, guildId);
					const breakStatus = activeBreak ? ' 🔄 *On Break*' : '';

					shiftLines.push(`• **${displayName}** - ${durationStr}${breakStatus}`);
				} catch (error) {
					const shiftDuration = currentTime - shift.start_time;
					const durationStr = this.formatDurationString(shiftDuration);
					const activeBreak = Database.breaks.findActiveBreak(shift.discord_id, guildId);
					const breakStatus = activeBreak ? ' 🔄 *On Break*' : '';

					shiftLines.push(`• <@${shift.discord_id}> - ${durationStr}${breakStatus}`);
				}
			}

			const container = this.buildContainer(
				'## 🕐 Active Shifts',
				[
					`**${activeShifts.length} employee${activeShifts.length !== 1 ? 's' : ''} currently active in the County:**`,
					'',
					...shiftLines
				].join('\n')
			);

			await this.sendOrUpdateActiveShiftMessage(channel as TextChannel, container);
		} catch (error) {
			this.client?.logger.error('Failed to update active shift display:', error);
		}
	}

	private async sendOrUpdateActiveShiftMessage(channel: TextChannel, container: ContainerBuilder): Promise<void> {
		try {
			const messages = await channel.messages.fetch({ limit: 50 });
			const existingMessage = messages.find((msg) => msg.author.id === this.client?.user?.id && msg.components.length > 0);

			if (existingMessage) {
				await existingMessage.edit({
					components: [container]
				});
			} else {
				await channel.send({
					components: [container]
				});
			}
		} catch (error) {
			this.client?.logger.error('Failed to send/update active shift message:', error);
		}
	}

	private buildContainer(header: string, content: string): ContainerBuilder {
		const container = new ContainerBuilder();
		const headerDisplay = new TextDisplayBuilder().setContent(header);
		const contentDisplay = new TextDisplayBuilder().setContent(content);

		container.addTextDisplayComponents(headerDisplay);
		container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(contentDisplay);

		return container;
	}

	private formatDurationString(seconds: number): string {
		const months = Math.floor(seconds / (30 * 24 * 3600));
		const days = Math.floor((seconds % (30 * 24 * 3600)) / (24 * 3600));
		const hours = Math.floor((seconds % (24 * 3600)) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);

		if (parts.length === 0) parts.push('0m');

		return parts.join(' ');
	}
}
