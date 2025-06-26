import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize, TextChannel } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Database } from '../lib/database';
import { TaskManager } from '../lib/tasks';
import { Config } from '../lib/config';

@ApplyOptions<Subcommand.Options>({
	name: Config.org.shift_term,
	description: Config.formatText(Config.ui.commands.shift_main_description),
	preconditions: ['StaffAccess'],
	subcommands: [
		{
			name: 'self',
			type: 'group',
			entries: [
				{
					name: 'toggle',
					chatInputRun: 'selfToggleFlow'
				},
				{
					name: 'view',
					chatInputRun: 'selfViewFlow'
				}
			]
		},
		{
			name: 'department',
			type: 'group',
			entries: [
				{
					name: 'adjust',
					preconditions: ['CommandAccess'],
					chatInputRun: 'departmentAdjustFlow'
				},
				{
					name: 'reset',
					preconditions: ['CommandAccess'],
					chatInputRun: 'departmentResetFlow'
				},
				{
					name: 'toggle',
					preconditions: ['CommandAccess'],
					chatInputRun: 'departmentToggleFlow'
				},
				{
					name: 'view',
					preconditions: ['CommandAccess'],
					chatInputRun: 'departmentViewFlow'
				}
			]
		}
	],
	runIn: ['GUILD_ANY']
})
export class ShiftCommand extends Subcommand {
	private async validateGuildContext(interaction: Subcommand.ChatInputCommandInteraction): Promise<boolean> {
		if (!interaction.guildId) {
			const container = this.buildErrorContainer('Server Only', 'This command can only be used in a server.');
			await this.replyWithContainer(interaction, container);
			return false;
		}
		return true;
	}

	private formatDuration(seconds: number): { months: number; days: number; hours: number; minutes: number } {
		return {
			months: Math.floor(seconds / (30 * 24 * 3600)),
			days: Math.floor((seconds % (30 * 24 * 3600)) / (24 * 3600)),
			hours: Math.floor((seconds % (24 * 3600)) / 3600),
			minutes: Math.floor((seconds % 3600) / 60)
		};
	}

	private formatDurationString(seconds: number): string {
		const { months, days, hours, minutes } = this.formatDuration(seconds);

		const parts: string[] = [];
		if (months > 0) parts.push(`${months}mo`);
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);

		if (parts.length === 0) parts.push('0m');

		return parts.join(' ');
	}

	private isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	private getUnitChoices() {
		return Config.units.map(unit => ({ name: unit.name, value: unit.code }));
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

	private buildMultiSectionContainer(header: string, sections: string[]): ContainerBuilder {
		const container = new ContainerBuilder();
		const headerDisplay = new TextDisplayBuilder().setContent(header);
		container.addTextDisplayComponents(headerDisplay);

		sections.forEach((section) => {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			const sectionDisplay = new TextDisplayBuilder().setContent(section);
			container.addTextDisplayComponents(sectionDisplay);
		});

		return container;
	}

	private buildErrorContainer(title: string, message: string): ContainerBuilder {
		return this.buildContainer(`## ❌ ${title}`, message);
	}

	private async replyWithContainer(interaction: Subcommand.ChatInputCommandInteraction, container: ContainerBuilder): Promise<any> {
		return interaction.reply({
			components: [container],
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
		});
	}

	private async handleError(
		interaction: Subcommand.ChatInputCommandInteraction,
		error: any,
		operation: string,
		userMessage?: string
	): Promise<any> {
		this.container.logger.error(`Error in ${operation}:`, error);

		const container = this.buildErrorContainer(
			'Error',
			userMessage || 'An error occurred while processing your request. Please try again later.'
		);

		return this.replyWithContainer(interaction, container);
	}

	private async formatUserInfoForLogs(guildId: string, user: { id: string }, label: string = 'User'): Promise<string> {
		try {
			const guild = await this.container.client.guilds.fetch(guildId);
			const member = await guild.members.fetch(user.id);
			const displayName = member.displayName;
			return `**${label}:** ${displayName} (<@${user.id}>)`;
		} catch (error) {
			return `**${label}:** <@${user.id}>`;
		}
	}

	private async formatActionInfoForLogs(guildId: string, actionBy: { id: string }): Promise<string> {
		try {
			const guild = await this.container.client.guilds.fetch(guildId);
			const member = await guild.members.fetch(actionBy.id);
			const displayName = member.displayName;
			return `**Action By:** ${displayName} (<@${actionBy.id}>)`;
		} catch (error) {
			return `**Action By:** <@${actionBy.id}>`;
		}
	}

	private async getDisplayName(guildId: string, userId: string): Promise<string> {
		try {
			const guild = await this.container.client.guilds.fetch(guildId);
			const member = await guild.members.fetch(userId);
			return member.displayName;
		} catch (error) {
			return `<@${userId}>`;
		}
	}

	private async logShiftAction(
		guildId: string,
		action:
			| 'shift-started'
			| 'shift-ended'
			| 'break-started'
			| 'break-ended'
			| 'force-shift-started'
			| 'force-shift-ended'
			| 'force-break-started'
			| 'force-break-ended',
		user: { id: string },
		data: Record<string, any>,
		actionBy?: { id: string }
	): Promise<void> {
		const actionConfig = {
			'shift-started': { icon: '🟢', title: 'Shift Started' },
			'shift-ended': { icon: '🔴', title: 'Shift Ended' },
			'break-started': { icon: '🟡', title: 'Break Started' },
			'break-ended': { icon: '🟠', title: 'Break Ended' },
			'force-shift-started': { icon: '🟢', title: 'Force Started Shift' },
			'force-shift-ended': { icon: '🔴', title: 'Force Ended Shift' },
			'force-break-started': { icon: '🟡', title: 'Force Started Break' },
			'force-break-ended': { icon: '🟠', title: 'Force Ended Break' }
		};

		const config = actionConfig[action];
		const header = `## ${config.icon} ${config.title}`;

		const userInfo = await this.formatUserInfoForLogs(guildId, user);
		const infoLines = [userInfo, ...Object.entries(data).map(([key, value]) => `**${key}:** ${value}`)];

		if (actionBy) {
			const actionByInfo = await this.formatActionInfoForLogs(guildId, actionBy);
			infoLines.push(actionByInfo);
		}

		const container = this.buildContainer(header, infoLines.join('\n'));
		await this.logToShiftChannel(guildId, container);
	}

	private async logToShiftChannel(guildId: string, container: ContainerBuilder): Promise<void> {
		try {
			const guildSettings = Database.guildSettings.findByGuildId(guildId);
			if (!guildSettings?.shift_logs_channel_id) {
				return;
			}

			const channel = await this.container.client.channels.fetch(guildSettings.shift_logs_channel_id);
			if (channel?.isTextBased()) {
				await (channel as TextChannel).send({
					components: [container],
					flags: [MessageFlags.IsComponentsV2]
				});
			}
		} catch (error) {
			this.container.logger.error('Failed to log to shift channel:', error);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommandGroup((group) =>
					group
						.setName('self')
						.setDescription(Config.formatText(Config.ui.commands.shift_self_description))
						.addSubcommand((subcommand) =>
							subcommand
								.setName('toggle')
								.setDescription('clock in/out of your shift')
								.addStringOption((option) =>
									option
										.setName('type')
										.setDescription('type of shift to toggle')
										.setRequired(true)
										.addChoices({ name: 'Shift', value: 'shift' }, { name: 'Break', value: 'break' })
								)
								.addStringOption((option) => option.setName('proof').setDescription('Proof of shift').setRequired(true))
								.addStringOption((option) =>
									option
										.setName('unit')
										.setDescription('unit to shift as (required when starting shift)')
										.addChoices(...this.getUnitChoices())
								)
						)
						.addSubcommand((subcommand) =>
							subcommand
								.setName('view')
								.setDescription('view your shifts')
								.addStringOption((option) =>
									option
										.setName('type')
										.setDescription('type of shift to toggle')
										.setRequired(true)
										.addChoices(
											{ name: 'Logged Time', value: 'loggedtime' },
											{ name: 'Last Shift', value: 'lastshift' },
											{ name: 'All Shifts', value: 'allshifts' }
										)
								)
								.addStringOption((option) =>
									option
										.setName('unit')
										.setDescription('filter by unit')
										.addChoices(...this.getUnitChoices())
								)
						)
				)
				.addSubcommandGroup((group) =>
					group
						.setName('department')
						.setDescription('ok')
						.addSubcommand((subcommand) =>
							subcommand
								.setName('adjust')
								.setDescription('Adjust a members shift time')
								.addUserOption((option) => option.setName('user').setDescription('The user to adjust').setRequired(true))
								.addIntegerOption((option) => option.setName('shift_id').setDescription('The shift ID to adjust').setRequired(true))
								.addStringOption((option) =>
									option
										.setName('action')
										.setDescription('Action to perform')
										.setRequired(true)
										.addChoices(
											{ name: 'Add Time', value: 'add' },
											{ name: 'Remove Time', value: 'remove' },
											{ name: 'Delete Shift', value: 'delete' }
										)
								)
								.addStringOption((option) => option.setName('reason').setDescription('Reason for adjustment').setRequired(true))
								.addIntegerOption((option) =>
									option.setName('minutes').setDescription('Minutes to add/remove (not needed for delete)')
								)
						)
						.addSubcommand((subcommand) =>
							subcommand
								.setName('reset')
								.setDescription('Reset the current week shifts for all department members')
								.addStringOption((option) =>
									option.setName('confirmation').setDescription('Type "RESET" to confirm').setRequired(true)
								)
						)
						.addSubcommand((subcommand) =>
							subcommand
								.setName('toggle')
								.setDescription('Force toggle a members shift or break')
								.addUserOption((option) => option.setName('user').setDescription('The user to toggle for').setRequired(true))
								.addStringOption((option) =>
									option
										.setName('type')
										.setDescription('Type to toggle')
										.setRequired(true)
										.addChoices({ name: 'Shift', value: 'shift' }, { name: 'Break', value: 'break' })
								)
								.addStringOption((option) => option.setName('reason').setDescription('Reason for force toggle').setRequired(true))
						)
						.addSubcommand((subcommand) =>
							subcommand
								.setName('view')
								.setDescription('View department or specific user shifts')
								.addStringOption((option) =>
									option
										.setName('type')
										.setDescription('View type')
										.setRequired(true)
										.addChoices(
											{ name: 'Department Overview', value: 'department' },
											{ name: 'User Details', value: 'user' },
											{ name: 'Weekly Summary', value: 'weekly' }
										)
								)
								.addUserOption((option) => option.setName('user').setDescription('Specific user (required for User Details)'))
								.addIntegerOption((option) =>
									option
										.setName('week')
										.setDescription('Week offset (0=current, -1=last week, etc.)')
										.setMinValue(-3)
										.setMaxValue(0)
								)
								.addStringOption((option) =>
									option
										.setName('unit')
										.setDescription('filter by unit')
										.addChoices(...this.getUnitChoices())
								)
						)
				)
		);
	}

	public async selfToggleFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!(await this.validateGuildContext(interaction))) return;

		const type = interaction.options.getString('type', true);
		const proof = interaction.options.getString('proof', true);
		const unit = interaction.options.getString('unit');

		if (!this.isValidUrl(proof)) {
			const container = this.buildErrorContainer('Invalid Proof', 'Proof must be a valid URL.');
			return this.replyWithContainer(interaction, container);
		}

		try {
			if (type === 'shift') {
				const activeShift = Database.shifts.findActiveShift(interaction.user.id, interaction.guildId!);

				if (activeShift) {
					const activeBreak = Database.breaks.findActiveBreak(interaction.user.id, interaction.guildId!);
					if (activeBreak) {
						Database.breaks.endBreak(activeBreak.id);
					}

					Database.shifts.endShift(activeShift.id);

					const rawDuration = Math.floor(Date.now() / 1000 - activeShift.start_time);
					const breakTime = Database.breaks.getTotalBreakTimeForShift(activeShift.id);
					const effectiveDuration = Math.max(0, rawDuration - breakTime);
					const effectiveDurationStr = this.formatDurationString(effectiveDuration);
					const breakTimeStr = this.formatDurationString(breakTime);

					await this.logShiftAction(interaction.guildId!, 'shift-ended', interaction.user, {
						Unit: activeShift.unit || 'N/A',
						'Effective Duration': effectiveDurationStr,
						'Break Time': breakTimeStr,
						Proof: proof,
						'Shift ID': activeShift.id.toString(),
						Started: `<t:${activeShift.start_time}:f>`,
						Ended: `<t:${Math.floor(Date.now() / 1000)}:f>`
					});

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId!);

					const container = this.buildMultiSectionContainer('## parkFLOW Shift Action - Ended', [
						'You have __ended__ your shift.',
						[
							`-# **Effective Duration:** ${effectiveDurationStr}`,
							`-# **Break Time:** ${breakTimeStr}`,
							`-# **Proof:** ${proof}`,
							`-# **Ended at:** <t:${Math.floor(Date.now() / 1000)}:t>`
						].join('\n')
					]);

					return this.replyWithContainer(interaction, container);
				} else {
					if (!unit) {
						const container = this.buildErrorContainer('Unit Required', 'Please select a unit when starting your shift.');
						return this.replyWithContainer(interaction, container);
					}

					const newShift = Database.shifts.startShift(interaction.user.id, interaction.guildId!, unit);

					await this.logShiftAction(interaction.guildId!, 'shift-started', interaction.user, {
						Unit: unit,
						Proof: proof,
						'Shift ID': newShift.id.toString(),
						Started: `<t:${Math.floor(Date.now() / 1000)}:f>`
					});

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId!);

					const container = this.buildMultiSectionContainer('## parkFLOW Shift Action - Started', [
						'You have __started__ your shift.',
						[`-# **Started:** <t:${Math.floor(Date.now() / 1000)}:t>`, `-# **Proof:** ${proof}`].join('\n')
					]);

					return this.replyWithContainer(interaction, container);
				}
			} else if (type === 'break') {
				const activeShift = Database.shifts.findActiveShift(interaction.user.id, interaction.guildId!);

				if (!activeShift) {
					const container = this.buildErrorContainer('No Active Shift', 'You must have an active shift to take a break.');
					return this.replyWithContainer(interaction, container);
				}

				const activeBreak = Database.breaks.findActiveBreak(interaction.user.id, interaction.guildId!);

				if (activeBreak) {
					Database.breaks.endBreak(activeBreak.id);

					const duration = Math.floor(Date.now() / 1000 - activeBreak.start_time);
					const durationStr = this.formatDurationString(duration);

					await this.logShiftAction(interaction.guildId!, 'break-ended', interaction.user, {
						Duration: durationStr,
						Proof: proof,
						'Break ID': activeBreak.id.toString(),
						Started: `<t:${activeBreak.start_time}:f>`,
						Ended: `<t:${Math.floor(Date.now() / 1000)}:f>`
					});

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId!);

					const container = this.buildMultiSectionContainer('## parkFLOW Shift Action - Break Ended', [
						'You have __ended__ your break.',
						[`-# **Duration:** ${durationStr}`, `-# **Proof:** ${proof}`, `-# **Ended at:** <t:${Math.floor(Date.now() / 1000)}:t>`].join(
							'\n'
						)
					]);

					return this.replyWithContainer(interaction, container);
				} else {
					const newBreak = Database.breaks.startBreak(activeShift.id, interaction.user.id, interaction.guildId!);

					await this.logShiftAction(interaction.guildId!, 'break-started', interaction.user, {
						Proof: proof,
						'Break ID': newBreak.id.toString(),
						'Shift ID': activeShift.id.toString(),
						Started: `<t:${Math.floor(Date.now() / 1000)}:f>`
					});

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId!);

					const container = this.buildMultiSectionContainer('## parkFLOW Shift Action - Break Started', [
						'You have __started__ your break.',
						[`-# **Started:** <t:${Math.floor(Date.now() / 1000)}:t>`, `-# **Proof:** ${proof}`].join('\n')
					]);

					return this.replyWithContainer(interaction, container);
				}
			}

			const container = this.buildErrorContainer('Invalid Type', 'Please specify a valid type.');
			return this.replyWithContainer(interaction, container);
		} catch (error) {
			return this.handleError(interaction, error, 'shift self toggle');
		}
	}

	public async selfViewFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			return interaction.reply({
				content: 'This command can only be used in a server.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const type = interaction.options.getString('type', true);
		const unitFilter = interaction.options.getString('unit');

		try {
			if (type === 'loggedtime') {
				const allShifts = Database.shifts.findByDiscordId(interaction.user.id, interaction.guildId);
				const filteredShifts = unitFilter ? allShifts.filter((shift) => shift.unit === unitFilter) : allShifts;
				let totalEffectiveSeconds = 0;
				let totalBreakSeconds = 0;

				for (const shift of filteredShifts) {
					if (shift.end_time) {
						const shiftDuration = Database.shifts.getShiftDuration(shift);
						const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);
						totalEffectiveSeconds += Math.max(0, shiftDuration - breakTime);
						totalBreakSeconds += breakTime;
					}
				}

				const effectiveHours = Math.floor(totalEffectiveSeconds / 3600);
				const effectiveMinutes = Math.floor((totalEffectiveSeconds % 3600) / 60);
				const breakHours = Math.floor(totalBreakSeconds / 3600);
				const breakMinutes = Math.floor((totalBreakSeconds % 3600) / 60);

				const totalRawSeconds = totalEffectiveSeconds + totalBreakSeconds;
				const rawHours = Math.floor(totalRawSeconds / 3600);
				const rawMinutes = Math.floor((totalRawSeconds % 3600) / 60);

				const titleSuffix = unitFilter ? ` (${unitFilter})` : '';
				const container = new ContainerBuilder();
				const display = new TextDisplayBuilder().setContent(
					`# 📊 Total Logged Time${titleSuffix}\n\n**Effective Work Time:** ${effectiveHours}h ${effectiveMinutes}m\n**Total Break Time:** ${breakHours}h ${breakMinutes}m\n**Raw Time:** ${rawHours}h ${rawMinutes}m`
				);

				container.addTextDisplayComponents(display);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			} else if (type === 'lastshift') {
				const shifts = Database.shifts.findByDiscordId(interaction.user.id, interaction.guildId);
				const filteredShifts = unitFilter ? shifts.filter((shift) => shift.unit === unitFilter) : shifts;
				const lastShift = filteredShifts[0];

				if (!lastShift) {
					const container = new ContainerBuilder();
					const display = new TextDisplayBuilder().setContent(`# ❌ No Previous Shifts\n\nYou have not logged any shifts yet.`);

					container.addTextDisplayComponents(display);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}

				const startTime = `<t:${lastShift.start_time}:f>`;
				const endTime = lastShift.end_time ? `<t:${lastShift.end_time}:f>` : '🔄 Currently Active';
				const rawDuration = lastShift.end_time
					? Math.floor(lastShift.end_time - lastShift.start_time)
					: Math.floor(Date.now() / 1000 - lastShift.start_time);

				const breakTime = Database.breaks.getTotalBreakTimeForShift(lastShift.id);
				const effectiveDuration = Math.max(0, rawDuration - breakTime);

				const rawHours = Math.floor(rawDuration / 3600);
				const rawMinutes = Math.floor((rawDuration % 3600) / 60);
				const effectiveHours = Math.floor(effectiveDuration / 3600);
				const effectiveMinutes = Math.floor((effectiveDuration % 3600) / 60);
				const breakHours = Math.floor(breakTime / 3600);
				const breakMinutes = Math.floor((breakTime % 3600) / 60);
				const status = lastShift.end_time ? '✅' : '🔄';

				const activeBreak = lastShift.end_time ? null : Database.breaks.findActiveBreak(interaction.user.id, interaction.guildId);
				const breakStatus = activeBreak ? ' (On Break)' : '';
				const titleSuffix = unitFilter ? ` (${unitFilter})` : '';
				const unitInfo = lastShift.unit ? `\n**Unit:** ${lastShift.unit}` : '';

				const container = new ContainerBuilder();
				const display = new TextDisplayBuilder().setContent(
					`# ${status} Last Shift${breakStatus}${titleSuffix}${unitInfo}\n\n**Started:** ${startTime}\n**Ended:** ${endTime}\n**Effective Duration:** ${effectiveHours}h ${effectiveMinutes}m\n**Break Time:** ${breakHours}h ${breakMinutes}m\n**Raw Duration:** ${rawHours}h ${rawMinutes}m`
				);

				container.addTextDisplayComponents(display);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			} else if (type === 'allshifts') {
				const shifts = Database.shifts.findByDiscordId(interaction.user.id, interaction.guildId);
				const filteredShifts = unitFilter ? shifts.filter((shift) => shift.unit === unitFilter) : shifts;

				if (filteredShifts.length === 0) {
					const container = new ContainerBuilder();
					const display = new TextDisplayBuilder().setContent(`# ❌ No Shifts Found\n\nYou have not logged any shifts yet.`);

					container.addTextDisplayComponents(display);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}

				const shiftLines = filteredShifts.slice(0, 10).map((shift, index) => {
					const startTime = `<t:${shift.start_time}:d>`;
					const rawDuration = shift.end_time
						? Math.floor(shift.end_time - shift.start_time)
						: Math.floor(Date.now() / 1000 - shift.start_time);

					const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);
					const effectiveDuration = Math.max(0, rawDuration - breakTime);

					const effectiveHours = Math.floor(effectiveDuration / 3600);
					const effectiveMinutes = Math.floor((effectiveDuration % 3600) / 60);
					const status = shift.end_time ? '✅' : '🔄';

					const breakInfo = breakTime > 0 ? ` (${Math.floor(breakTime / 60)}m break)` : '';
					const unitInfo = shift.unit ? ` [${shift.unit}]` : '';

					return `**${index + 1}.** ${status} ${startTime} - **${effectiveHours}h ${effectiveMinutes}m**${breakInfo}${unitInfo}`;
				});

				const totalCount = filteredShifts.length;
				const showing = Math.min(10, totalCount);

				const titleSuffix = unitFilter ? ` (${unitFilter})` : '';
				const container = new ContainerBuilder();
				const display = new TextDisplayBuilder().setContent(
					`# 📋 All Shifts${titleSuffix} (${showing}/${totalCount})\n\n${shiftLines.join('\n\n')}${totalCount > 10 ? '\n\n*Showing latest 10 shifts*' : ''}`
				);

				container.addTextDisplayComponents(display);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			const container = new ContainerBuilder();
			const display = new TextDisplayBuilder().setContent(`# ❌ Invalid Type\n\nPlease specify a valid type.`);

			container.addTextDisplayComponents(display);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Error in shift self view:', error);

			const container = new ContainerBuilder();
			const display = new TextDisplayBuilder().setContent(
				`# ⚠️ Error\n\nAn error occurred while retrieving your shift information. Please try again.`
			);

			container.addTextDisplayComponents(display);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}
	}

	public async departmentAdjustFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			const container = new ContainerBuilder();
			const display = new TextDisplayBuilder().setContent(`## ❌ Server Only\n\nThis command can only be used in a server.`);

			container.addTextDisplayComponents(display);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}

		const user = interaction.options.getUser('user', true);
		const shiftId = interaction.options.getInteger('shift_id', true);
		const action = interaction.options.getString('action', true);
		const reason = interaction.options.getString('reason', true);
		const minutes = interaction.options.getInteger('minutes');

		try {
			const shift = Database.shifts.findById(shiftId);

			if (!shift) {
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## ❌ Shift Not Found`);
				const info = new TextDisplayBuilder().setContent(`Shift ID ${shiftId} was not found.`);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(info);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			if (shift.discord_id !== user.id || shift.guild_id !== interaction.guildId) {
				const userDisplayName = await this.getDisplayName(interaction.guildId!, user.id);
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## ❌ Invalid Shift Owner`);
				const info = new TextDisplayBuilder().setContent(`Shift does not belong to ${userDisplayName} in this server.`);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(info);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			if (action === 'delete') {
				Database.shifts.delete(shiftId);

				const userDisplayName = await this.getDisplayName(interaction.guildId!, user.id);
				const actionByDisplayName = await this.getDisplayName(interaction.guildId!, interaction.user.id);
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## 🗑️ Shift Deleted`);
				const info = new TextDisplayBuilder().setContent(
					[
						`**Target User:** ${userDisplayName}`,
						`**Shift ID:** ${shiftId}`,
						`**Reason:** ${reason}`,
						`**Action By:** ${actionByDisplayName}`
					].join('\n')
				);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(info);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			if (!minutes || minutes <= 0) {
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## ❌ Invalid Minutes`);
				const info = new TextDisplayBuilder().setContent(`Please specify a positive number of minutes for add/remove actions.`);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(info);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			const adjustmentSeconds = action === 'add' ? minutes * 60 : -(minutes * 60);
			const adjustedShift = Database.shifts.adjustShiftTime(shiftId, adjustmentSeconds);

			if (!adjustedShift) {
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## ❌ Adjustment Failed`);
				const info = new TextDisplayBuilder().setContent(`Failed to adjust shift. The shift may be active or invalid.`);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(info);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			const effectiveDuration = Database.shifts.getEffectiveShiftDuration(adjustedShift, Database.breaks);
			const hours = Math.floor(effectiveDuration / 3600);
			const mins = Math.floor((effectiveDuration % 3600) / 60);

			const userDisplayName = await this.getDisplayName(interaction.guildId!, user.id);
			const actionByDisplayName = await this.getDisplayName(interaction.guildId!, interaction.user.id);
			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚙️ Shift Adjusted`);
			const info = new TextDisplayBuilder().setContent(
				[
					`**Target User:** ${userDisplayName}`,
					`**Shift ID:** ${shiftId}`,
					`**Adjustment:** ${action === 'add' ? '+' : '-'}${minutes} minutes`,
					`**New Duration:** ${hours}h ${mins}m`,
					`**Reason:** ${reason}`,
					`**Action By:** ${actionByDisplayName}`
				].join('\n')
			);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Error in department adjust:', error);

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚠️ Error`);
			const info = new TextDisplayBuilder().setContent(`An error occurred while adjusting the shift. Please try again later.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}
	}

	public async departmentResetFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			const container = new ContainerBuilder();
			const display = new TextDisplayBuilder().setContent(`## ❌ Server Only\n\nThis command can only be used in a server.`);

			container.addTextDisplayComponents(display);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}

		const confirmation = interaction.options.getString('confirmation', true);

		if (confirmation !== 'RESET') {
			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚠️ Confirmation Required`);
			const warning = new TextDisplayBuilder().setContent(
				[
					`To confirm the weekly reset, please type "RESET" exactly.`,
					'',
					`⚠️ **Warning:** This will delete all current week shifts and cannot be undone.`
				].join('\n')
			);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(warning);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}

		try {
			const currentWeekShifts = Database.shifts.getShiftsByWeek(interaction.guildId, 0);
			const uniqueUsers = new Set(currentWeekShifts.map((shift) => shift.discord_id));
			const deletedCount = Database.shifts.clearWeeklyShifts(interaction.guildId);

			const resetByDisplayName = await this.getDisplayName(interaction.guildId, interaction.user.id);
			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ✅ Weekly Reset Complete`);
			const info = new TextDisplayBuilder().setContent(
				[`**Shifts Deleted:** ${deletedCount}`, `**Users Affected:** ${uniqueUsers.size}`, `**Reset By:** ${resetByDisplayName}`].join('\n')
			);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Error in department reset:', error);

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚠️ Error`);
			const info = new TextDisplayBuilder().setContent(`An error occurred while resetting weekly shifts. Please try again later.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}
	}

	public async departmentToggleFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			return interaction.reply({
				content: 'This command can only be used in a server.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const user = interaction.options.getUser('user', true);
		const type = interaction.options.getString('type', true);
		const reason = interaction.options.getString('reason', true);

		try {
			if (type === 'shift') {
				const activeShift = Database.shifts.findActiveShift(user.id, interaction.guildId);

				if (activeShift) {
					const activeBreak = Database.breaks.findActiveBreak(user.id, interaction.guildId);
					if (activeBreak) {
						Database.breaks.endBreak(activeBreak.id);
					}

					Database.shifts.endShift(activeShift.id);
					const effectiveDuration = Database.shifts.getEffectiveShiftDuration(activeShift, Database.breaks);
					const hours = Math.floor(effectiveDuration / 3600);
					const minutes = Math.floor((effectiveDuration % 3600) / 60);

					const userDisplayName = await this.getDisplayName(interaction.guildId, user.id);
					const actionByDisplayName = await this.getDisplayName(interaction.guildId, interaction.user.id);
					const logContainer = new ContainerBuilder();
					const logHeader = new TextDisplayBuilder().setContent(`## 🔴 Force Ended Shift`);
					const logInfo = new TextDisplayBuilder().setContent(
						[
							`**User:** ${userDisplayName} (${user.id})`,
							`**Duration:** ${hours}h ${minutes}m`,
							`**Reason:** ${reason}`,
							`**Force Toggled By:** ${actionByDisplayName} (${interaction.user.id})`,
							`**Shift ID:** ${activeShift.id}`,
							`**Started:** <t:${activeShift.start_time}:f>`,
							`**Ended:** <t:${Math.floor(Date.now() / 1000)}:f>`
						].join('\n')
					);

					logContainer.addTextDisplayComponents(logHeader);
					logContainer.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					logContainer.addTextDisplayComponents(logInfo);

					await this.logToShiftChannel(interaction.guildId, logContainer);

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId);

					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## parkFLOW Department Action - Force Ended Shift`);
					const info = new TextDisplayBuilder().setContent(
						[
							`**Target User:** ${userDisplayName}`,
							`**Duration:** ${hours}h ${minutes}m`,
							`**Reason:** ${reason}`,
							`**Action By:** ${actionByDisplayName}`
						].join('\n')
					);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				} else {
					const newShift = Database.shifts.startShift(user.id, interaction.guildId);

					const userDisplayName = await this.getDisplayName(interaction.guildId, user.id);
					const actionByDisplayName = await this.getDisplayName(interaction.guildId, interaction.user.id);
					const logContainer = new ContainerBuilder();
					const logHeader = new TextDisplayBuilder().setContent(`## 🟢 Force Started Shift`);
					const logInfo = new TextDisplayBuilder().setContent(
						[
							`**User:** ${userDisplayName} (${user.id})`,
							`**Reason:** ${reason}`,
							`**Force Toggled By:** ${actionByDisplayName} (${interaction.user.id})`,
							`**Shift ID:** ${newShift.id}`,
							`**Started:** <t:${Math.floor(Date.now() / 1000)}:f>`
						].join('\n')
					);

					logContainer.addTextDisplayComponents(logHeader);
					logContainer.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					logContainer.addTextDisplayComponents(logInfo);

					await this.logToShiftChannel(interaction.guildId, logContainer);

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId);

					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## parkFLOW Department Action - Force Started Shift`);
					const info = new TextDisplayBuilder().setContent(
						[`**Target User:** ${userDisplayName}`, `**Reason:** ${reason}`, `**Action By:** ${actionByDisplayName}`].join('\n')
					);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}
			} else if (type === 'break') {
				const activeShift = Database.shifts.findActiveShift(user.id, interaction.guildId);

				if (!activeShift) {
					const userDisplayName = await this.getDisplayName(interaction.guildId, user.id);
					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## ❌ No Active Shift`);
					const info = new TextDisplayBuilder().setContent(`${userDisplayName} does not have an active shift to take a break from.`);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}

				const activeBreak = Database.breaks.findActiveBreak(user.id, interaction.guildId);

				if (activeBreak) {
					Database.breaks.endBreak(activeBreak.id);
					const duration = Math.floor(Date.now() / 1000 - activeBreak.start_time);
					const hours = Math.floor(duration / 3600);
					const minutes = Math.floor((duration % 3600) / 60);

					const userDisplayName = await this.getDisplayName(interaction.guildId, user.id);
					const actionByDisplayName = await this.getDisplayName(interaction.guildId, interaction.user.id);
					const logContainer = new ContainerBuilder();
					const logHeader = new TextDisplayBuilder().setContent(`## 🟠 Force Ended Break`);
					const logInfo = new TextDisplayBuilder().setContent(
						[
							`**User:** ${userDisplayName} (${user.id})`,
							`**Duration:** ${hours}h ${minutes}m`,
							`**Reason:** ${reason}`,
							`**Force Toggled By:** ${actionByDisplayName} (${interaction.user.id})`,
							`**Break ID:** ${activeBreak.id}`,
							`**Started:** <t:${activeBreak.start_time}:f>`,
							`**Ended:** <t:${Math.floor(Date.now() / 1000)}:f>`
						].join('\n')
					);

					logContainer.addTextDisplayComponents(logHeader);
					logContainer.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					logContainer.addTextDisplayComponents(logInfo);

					await this.logToShiftChannel(interaction.guildId, logContainer);

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId);

					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## parkFLOW Department Action - Force Ended Break`);
					const info = new TextDisplayBuilder().setContent(
						[
							`**Target User:** ${userDisplayName}`,
							`**Duration:** ${hours}h ${minutes}m`,
							`**Reason:** ${reason}`,
							`**Action By:** ${actionByDisplayName}`
						].join('\n')
					);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				} else {
					const newBreak = Database.breaks.startBreak(activeShift.id, user.id, interaction.guildId);

					const userDisplayName = await this.getDisplayName(interaction.guildId, user.id);
					const actionByDisplayName = await this.getDisplayName(interaction.guildId, interaction.user.id);
					const logContainer = new ContainerBuilder();
					const logHeader = new TextDisplayBuilder().setContent(`## 🟡 Force Started Break`);
					const logInfo = new TextDisplayBuilder().setContent(
						[
							`**User:** ${userDisplayName} (${user.id})`,
							`**Reason:** ${reason}`,
							`**Force Toggled By:** ${actionByDisplayName} (${interaction.user.id})`,
							`**Break ID:** ${newBreak.id}`,
							`**Shift ID:** ${activeShift.id}`,
							`**Started:** <t:${Math.floor(Date.now() / 1000)}:f>`
						].join('\n')
					);

					logContainer.addTextDisplayComponents(logHeader);
					logContainer.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					logContainer.addTextDisplayComponents(logInfo);

					await this.logToShiftChannel(interaction.guildId, logContainer);

					await TaskManager.getInstance().updateActiveShiftDisplayForGuild(interaction.guildId);

					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## parkFLOW Department Action - Force Started Break`);
					const info = new TextDisplayBuilder().setContent(
						[`**Target User:** ${userDisplayName}`, `**Reason:** ${reason}`, `**Action By:** ${actionByDisplayName}`].join('\n')
					);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}
			}

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ❌ Invalid Type`);
			const info = new TextDisplayBuilder().setContent(`Please specify either 'shift' or 'break' as the type.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Error in department toggle:', error);

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚠️ Error`);
			const info = new TextDisplayBuilder().setContent(`An error occurred while toggling the user's shift/break. Please try again later.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}
	}

	public async departmentViewFlow(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			return interaction.reply({
				content: 'This command can only be used in a server.',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const type = interaction.options.getString('type', true);
		const user = interaction.options.getUser('user');
		const weekOffset = interaction.options.getInteger('week') ?? 0;
		const unitFilter = interaction.options.getString('unit');

		try {
			if (type === 'department') {
				const shifts = Database.shifts.getShiftsByWeek(interaction.guildId, weekOffset);
				const filteredShifts = unitFilter ? shifts.filter((shift) => shift.unit === unitFilter) : shifts;
				const userStats = new Map<string, { shifts: number; totalTime: number }>();

				for (const shift of filteredShifts) {
					if (shift.end_time) {
						const existing = userStats.get(shift.discord_id) || { shifts: 0, totalTime: 0 };
						const shiftDuration = Database.shifts.getShiftDuration(shift);
						const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);

						existing.shifts++;
						existing.totalTime += Math.max(0, shiftDuration - breakTime);
						userStats.set(shift.discord_id, existing);
					}
				}

				const weekLabel = weekOffset === 0 ? 'Current Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`;
				const unitLabel = unitFilter ? ` - ${unitFilter}` : '';
				const sortedUsers = Array.from(userStats.entries()).sort((a, b) => b[1].totalTime - a[1].totalTime);

				const lines = await Promise.all(
					sortedUsers.slice(0, 10).map(async ([userId, stats], index) => {
						const displayName = await this.getDisplayName(interaction.guildId!, userId);
						const hours = Math.floor(stats.totalTime / 3600);
						const minutes = Math.floor((stats.totalTime % 3600) / 60);
						return `${index + 1}. ${displayName} - ${hours}h ${minutes}m (${stats.shifts} shifts)`;
					})
				);

				const totalShifts = Array.from(userStats.values()).reduce((sum, stats) => sum + stats.shifts, 0);

				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## 📊 Department Overview - ${weekLabel}${unitLabel}`);
				const statsDisplay = new TextDisplayBuilder().setContent(
					[
						`**Active Users:** ${userStats.size}`,
						`**Total Shifts:** ${totalShifts}`,
						'',
						'**Top Performers:**',
						lines.length > 0 ? lines.join('\n') : '_No completed shifts found._'
					].join('\n')
				);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(statsDisplay);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			} else if (type === 'user') {
				if (!user) {
					const container = new ContainerBuilder();
					const header = new TextDisplayBuilder().setContent(`## ❌ Missing User`);
					const info = new TextDisplayBuilder().setContent(`Please specify a user for User Details view.`);

					container.addTextDisplayComponents(header);
					container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
					container.addTextDisplayComponents(info);

					return interaction.reply({
						components: [container],
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
					});
				}

				const userShifts = Database.shifts.findByDiscordId(user.id, interaction.guildId, 5);
				const filteredUserShifts = unitFilter ? userShifts.filter((shift) => shift.unit === unitFilter) : userShifts;
				const weekShifts = Database.shifts.getShiftsByWeek(interaction.guildId, weekOffset).filter((s) => s.discord_id === user.id);
				const filteredWeekShifts = unitFilter ? weekShifts.filter((shift) => shift.unit === unitFilter) : weekShifts;

				let weeklyTime = 0;
				let weeklyShiftCount = 0;

				for (const shift of filteredWeekShifts) {
					if (shift.end_time) {
						const shiftDuration = Database.shifts.getShiftDuration(shift);
						const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);
						weeklyTime += Math.max(0, shiftDuration - breakTime);
						weeklyShiftCount++;
					}
				}

				const weeklyHours = Math.floor(weeklyTime / 3600);
				const weeklyMinutes = Math.floor((weeklyTime % 3600) / 60);

				const activeShift = Database.shifts.findActiveShift(user.id, interaction.guildId);
				const activeBreak = activeShift ? Database.breaks.findActiveBreak(user.id, interaction.guildId) : null;
				const status = activeShift ? (activeBreak ? 'On Break' : 'Active Shift') : 'Off Shift';

				const weekLabel = weekOffset === 0 ? 'Current Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`;
				const unitLabel = unitFilter ? ` - ${unitFilter}` : '';

				const recentShifts = filteredUserShifts.slice(0, 3).map((shift) => {
					const date = new Date(shift.start_time * 1000).toLocaleDateString();
					const shiftDuration = Database.shifts.getShiftDuration(shift);
					const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);
					const effectiveDuration = Math.max(0, shiftDuration - breakTime);

					const hours = Math.floor(effectiveDuration / 3600);
					const minutes = Math.floor((effectiveDuration % 3600) / 60);
					const shiftStatus = shift.end_time ? '✅' : '🔄';

					return `${shiftStatus} ${date} - ${hours}h ${minutes}m (ID: ${shift.id})`;
				});

				const userDisplayName = await this.getDisplayName(interaction.guildId!, user.id);
				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## 👤 User Details - ${userDisplayName}${unitLabel}`);
				const statusInfo = new TextDisplayBuilder().setContent(`**Current Status:** ${status}`);
				const weekInfo = new TextDisplayBuilder().setContent(
					[
						`**${weekLabel} Summary:**`,
						`**Work Time:** ${weeklyHours}h ${weeklyMinutes}m`,
						`**Shifts Completed:** ${weeklyShiftCount}`
					].join('\n')
				);
				const recentInfo = new TextDisplayBuilder().setContent(
					[`**Recent Shifts:**`, recentShifts.length > 0 ? recentShifts.join('\n') : '_No shifts found_'].join('\n')
				);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(statusInfo);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(weekInfo);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(recentInfo);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			} else if (type === 'weekly') {
				const shifts = Database.shifts.getShiftsByWeek(interaction.guildId, weekOffset);
				const filteredShifts = unitFilter ? shifts.filter((shift) => shift.unit === unitFilter) : shifts;
				const dailyStats = new Map<string, { shifts: number; totalTime: number }>();

				for (const shift of filteredShifts) {
					if (shift.end_time) {
						const date = new Date(shift.start_time * 1000).toLocaleDateString();
						const existing = dailyStats.get(date) || { shifts: 0, totalTime: 0 };
						const shiftDuration = Database.shifts.getShiftDuration(shift);
						const breakTime = Database.breaks.getTotalBreakTimeForShift(shift.id);

						existing.shifts++;
						existing.totalTime += Math.max(0, shiftDuration - breakTime);
						dailyStats.set(date, existing);
					}
				}

				const weekLabel = weekOffset === 0 ? 'Current Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`;
				const unitLabel = unitFilter ? ` - ${unitFilter}` : '';
				const sortedDays = Array.from(dailyStats.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

				const dailyLines = sortedDays.map(([date, stats]) => {
					const hours = Math.floor(stats.totalTime / 3600);
					const minutes = Math.floor((stats.totalTime % 3600) / 60);
					return `${date}: ${stats.shifts} shifts, ${hours}h ${minutes}m`;
				});

				const totalTime = Array.from(dailyStats.values()).reduce((sum, stats) => sum + stats.totalTime, 0);
				const totalShifts = Array.from(dailyStats.values()).reduce((sum, stats) => sum + stats.shifts, 0);
				const totalHours = Math.floor(totalTime / 3600);
				const totalMinutes = Math.floor((totalTime % 3600) / 60);

				const container = new ContainerBuilder();
				const header = new TextDisplayBuilder().setContent(`## 📅 Weekly Summary - ${weekLabel}${unitLabel}`);
				const summaryInfo = new TextDisplayBuilder().setContent(
					[
						`**Total Work Time:** ${totalHours}h ${totalMinutes}m`,
						`**Total Shifts:** ${totalShifts}`,
						`**Active Days:** ${dailyStats.size}`
					].join('\n')
				);
				const dailyInfo = new TextDisplayBuilder().setContent(
					[`**Daily Breakdown:**`, dailyLines.length > 0 ? dailyLines.join('\n') : '_No data available_'].join('\n')
				);

				container.addTextDisplayComponents(header);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(summaryInfo);
				container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(dailyInfo);

				return interaction.reply({
					components: [container],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
				});
			}

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ❌ Invalid View Type`);
			const info = new TextDisplayBuilder().setContent(`Please use 'department', 'user', or 'weekly' as the view type.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Error in department view:', error);

			const container = new ContainerBuilder();
			const header = new TextDisplayBuilder().setContent(`## ⚠️ Error`);
			const info = new TextDisplayBuilder().setContent(`An error occurred while retrieving department data. Please try again later.`);

			container.addTextDisplayComponents(header);
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
			container.addTextDisplayComponents(info);

			return interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		}
	}
}
