import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorSpacingSize
} from 'discord.js';
import { Database } from '../lib/database';
import { Config } from '../lib/config';

@ApplyOptions<Command.Options>({
	description: Config.formatText(Config.ui.commands.server_setup_description),
	requiredUserPermissions: ['ManageGuild', 'Administrator']
})
export class ServerSetupCommand extends Command {
	private buildContainer(header: string, content: string): ContainerBuilder {
		const container = new ContainerBuilder();
		const headerDisplay = new TextDisplayBuilder().setContent(header);
		const contentDisplay = new TextDisplayBuilder().setContent(content);

		container.addTextDisplayComponents(headerDisplay);
		container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(contentDisplay);

		return container;
	}

	private buildErrorContainer(title: string, message: string): ContainerBuilder {
		return this.buildContainer(`## ❌ ${title}`, message);
	}

	private async replyWithContainer(interaction: Command.ChatInputCommandInteraction, container: ContainerBuilder): Promise<any> {
		try {
			if (interaction.deferred || interaction.replied) {
				return await interaction.editReply({
					components: [container],
					flags: [MessageFlags.IsComponentsV2]
				});
			}
			return await interaction.reply({
				components: [container],
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
			});
		} catch (error) {
			this.container.logger.error('Failed to send reply:', error);
		}
	}

	private getDayName(day: number): string {
		const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		return days[day] ?? 'Monday';
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addChannelOption((option) =>
					option
						.setName('action-logs-channel')
						.setDescription('Channel for action expiration logs (unused, feature in dev)')
						.addChannelTypes(0)
						.setRequired(false)
				)
				.addChannelOption((option) =>
					option.setName('shift-logs-channel').setDescription('Channel for shift logs').addChannelTypes(0).setRequired(false)
				)
				.addChannelOption((option) =>
					option.setName('active-shift-channel').setDescription('Channel for active shift display').addChannelTypes(0).setRequired(false)
				)
				.addRoleOption((option) => option.setName('access-role').setDescription('Role required for basic command access').setRequired(false))
				.addRoleOption((option) => option.setName('admin-role').setDescription('Role required for admin commands').setRequired(false))
				.addIntegerOption((option) =>
					option
						.setName('shift-cycle-start-day')
						.setDescription('Day biweekly shift cycles start on')
						.setRequired(false)
						.addChoices(
							{ name: 'Sunday', value: 0 },
							{ name: 'Monday', value: 1 },
							{ name: 'Tuesday', value: 2 },
							{ name: 'Wednesday', value: 3 },
							{ name: 'Thursday', value: 4 },
							{ name: 'Friday', value: 5 },
							{ name: 'Saturday', value: 6 }
						)
				)
				.setContexts(InteractionContextType.Guild)
				.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		if (!interaction.guildId) {
			const container = this.buildErrorContainer('Server Only', 'This command can only be used in a server.');
			return this.replyWithContainer(interaction, container);
		}

		const actionLogsChannel = interaction.options.getChannel('action-logs-channel');
		const shiftLogsChannel = interaction.options.getChannel('shift-logs-channel');
		const activeShiftChannel = interaction.options.getChannel('active-shift-channel');
		const accessRole = interaction.options.getRole('access-role');
		const adminRole = interaction.options.getRole('admin-role');
		const shiftCycleStartDay = interaction.options.getInteger('shift-cycle-start-day');

		if (!actionLogsChannel && !shiftLogsChannel && !activeShiftChannel && !accessRole && !adminRole && shiftCycleStartDay === null) {
			const currentSettings = Database.guildSettings.findByGuildId(interaction.guildId);

			if (!currentSettings) {
				const content = [
					'**Current Server Configuration:** No configuration found.',
					'',
					'Use the command options to set up your server:',
					'• `action-logs-channel` - Channel for action expiration logs',
					'• `shift-logs-channel` - Channel for shift logs',
					'• `active-shift-channel` - Channel for active shift display',
					'• `access-role` - Role required for basic command access',
					'• `admin-role` - Role required for admin commands',
					'• `shift-cycle-start-day` - Day biweekly shift cycles start on'
				].join('\n');

				const container = this.buildContainer('## ⚙️ Server Configuration', content);
				return this.replyWithContainer(interaction, container);
			}

			const configContent = [
				`• Action Logs Channel: ${currentSettings.action_logs_channel_id ? `<#${currentSettings.action_logs_channel_id}>` : 'Not set'}`,
				`• Shift Logs Channel: ${currentSettings.shift_logs_channel_id ? `<#${currentSettings.shift_logs_channel_id}>` : 'Not set'}`,
				`• Active Shift Channel: ${currentSettings.active_shift_channel_id ? `<#${currentSettings.active_shift_channel_id}>` : 'Not set'}`,
				`• Access Role: ${currentSettings.access_role_id ? `<@&${currentSettings.access_role_id}>` : 'Not set'}`,
				`• Admin Role: ${currentSettings.admin_role_id ? `<@&${currentSettings.admin_role_id}>` : 'Not set'}`,
				`• Shift Cycle Start Day: ${this.getDayName(currentSettings.shift_cycle_start_day ?? 1)}`
			].join('\n');

			const container = this.buildContainer('## ⚙️ Current Server Configuration', configContent);
			return this.replyWithContainer(interaction, container);
		}

		try {
			let guildSettings = Database.guildSettings.findByGuildId(interaction.guildId);

			const updates: any = {};
			if (actionLogsChannel) updates.action_logs_channel_id = actionLogsChannel.id;
			if (shiftLogsChannel) updates.shift_logs_channel_id = shiftLogsChannel.id;
			if (activeShiftChannel) updates.active_shift_channel_id = activeShiftChannel.id;
			if (accessRole) updates.access_role_id = accessRole.id;
			if (adminRole) updates.admin_role_id = adminRole.id;
			if (shiftCycleStartDay !== null) updates.shift_cycle_start_day = shiftCycleStartDay;

			if (guildSettings) {
				guildSettings = Database.guildSettings.update(interaction.guildId, updates);
			} else {
				guildSettings = Database.guildSettings.create(interaction.guildId, updates);
			}

			const responseLines = [];
			if (actionLogsChannel) responseLines.push(`• Action Logs Channel: ${actionLogsChannel}`);
			if (shiftLogsChannel) responseLines.push(`• Shift Logs Channel: ${shiftLogsChannel}`);
			if (activeShiftChannel) responseLines.push(`• Active Shift Channel: ${activeShiftChannel}`);
			if (accessRole) responseLines.push(`• Access Role: ${accessRole}`);
			if (adminRole) responseLines.push(`• Admin Role: ${adminRole}`);
			if (shiftCycleStartDay !== null) responseLines.push(`• Shift Cycle Start Day: ${this.getDayName(shiftCycleStartDay)}`);

			const container = this.buildContainer('## ✅ Server Configuration Updated', responseLines.join('\n'));
			return this.replyWithContainer(interaction, container);
		} catch (error) {
			this.container.logger.error('Error updating guild settings:', error);
			const container = this.buildErrorContainer('Error', 'An error occurred while updating server settings. Please try again.');
			return this.replyWithContainer(interaction, container);
		}
	}
}
