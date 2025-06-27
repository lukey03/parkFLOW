import type { SapphireClient } from '@sapphire/framework';
import { Database } from './database';
import { ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize, TextChannel, MessageFlags } from 'discord.js';
import { Config } from './config';

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
				const timestamp = Math.floor(Date.now() / 1000);
				const content = `_${Config.getActiveSummaryText(0)}_`;
				const timestampText = `-# Last updated <t:${timestamp}:R>`;
				const container = this.buildActiveShiftContainer(`## ${Config.ui.active_shifts_header}`, content, timestampText);
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

			const timestamp = Math.floor(Date.now() / 1000);
			const timestampText = `-# Last updated <t:${timestamp}:R>`;

			const { displayLines, totalCount, displayCount } = this.truncateShiftLines(shiftLines, activeShifts.length, timestampText);

			const content = [
				`**${Config.getActiveSummaryText(totalCount)}**`,
				displayCount < totalCount ? `_Showing ${displayCount} of ${totalCount}_` : '',
				'',
				...displayLines
			]
				.filter((line) => line !== '')
				.join('\n');

			const container = this.buildActiveShiftContainer(`## ${Config.ui.active_shifts_header}`, content, timestampText);

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
					components: [container],
					flags: [MessageFlags.IsComponentsV2]
				});
			} else {
				await channel.send({
					components: [container],
					flags: [MessageFlags.IsComponentsV2]
				});
			}
		} catch (error) {
			this.client?.logger.error('Failed to send/update active shift message:', error);
		}
	}

	private buildActiveShiftContainer(header: string, content: string, timestamp: string): ContainerBuilder {
		const container = new ContainerBuilder();
		const headerDisplay = new TextDisplayBuilder().setContent(header);
		const contentDisplay = new TextDisplayBuilder().setContent(content);
		const timestampDisplay = new TextDisplayBuilder().setContent(timestamp);

		container.addTextDisplayComponents(headerDisplay);
		container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(contentDisplay);
		container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(timestampDisplay);

		return container;
	}

	private truncateShiftLines(
		shiftLines: string[],
		totalCount: number,
		timestampText: string
	): { displayLines: string[]; totalCount: number; displayCount: number } {
		const MAX_CONTENT_LENGTH = 1800; // Conservative limit to leave room for header and timestamp

		const baseContent = [
			`**${Config.getActiveSummaryText(totalCount)}**`,
			`_Showing ${totalCount} of ${totalCount}_`, // Worst case scenario for length calculation
			''
		].join('\n');

		const baseLength = baseContent.length + timestampText.length + 100; // Buffer for separators and spacing
		let availableLength = MAX_CONTENT_LENGTH - baseLength;

		const displayLines: string[] = [];
		let currentLength = 0;

		for (const line of shiftLines) {
			const lineLength = line.length + 1; // +1 for newline

			if (currentLength + lineLength > availableLength) {
				break;
			}

			displayLines.push(line);
			currentLength += lineLength;
		}

		return {
			displayLines,
			totalCount,
			displayCount: displayLines.length
		};
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
