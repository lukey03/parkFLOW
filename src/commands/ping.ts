import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ApplicationIntegrationType, InteractionContextType,
	ContainerBuilder, MessageFlags,
	TextDisplayBuilder,
} from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Pong!'
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [
			InteractionContextType.Guild
		];

		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			integrationTypes,
			contexts
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.sendPing(interaction);
	}

	private async sendPing(interaction: Command.ChatInputCommandInteraction) {
		const pingContainer = new ContainerBuilder();

		const header = new TextDisplayBuilder()
			.setContent('## Pinging parkFLOW... 🏓');

		pingContainer.addTextDisplayComponents(header);

		const pingMessage = await interaction.reply({
			withResponse: true,
			components: [pingContainer],
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2]
		});

		if (!pingMessage) return;

		const pongContainer = new ContainerBuilder();

		const pongHeader = new TextDisplayBuilder()
			.setContent('# Pong! 🏓');

		pongContainer.addTextDisplayComponents(pongHeader);

		return interaction.editReply({
			components: [pongContainer],
			flags: [MessageFlags.IsComponentsV2]
		}).catch(error => {
			this.container.logger.error('Failed to edit reply:', error);
		});
	}
}
