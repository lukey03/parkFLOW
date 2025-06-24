import { AllFlowsPrecondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';
import { Database } from '../lib/database';

export class StaffAccessPrecondition extends AllFlowsPrecondition {
	public override chatInputRun(interaction: CommandInteraction) {
		return this.doCheck(interaction.user, interaction.guildId);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return this.doCheck(interaction.user, interaction.guildId);
	}

	public override messageRun(_message: Message) {
		return this.error({ message: 'Message commands are not supported.' });
	}

	private doCheck(user: CommandInteraction['user'], guildId: string | null) {
		if (!guildId) {
			return this.error({ message: 'This command can only be used in a server.' });
		}

		const guildSettings = Database.guildSettings.findByGuildId(guildId);
		if (!guildSettings?.access_role_id) {
			return this.error({ message: 'Server staff access role not configured.' });
		}

		const guild = this.container.client.guilds.cache.get(guildId);
		const member = guild?.members.cache.get(user.id);

		if (!member) {
			return this.error({ message: 'An error occurred while trying to fetch your member data, please try again.' });
		}

		const hasAdminRole = member.roles.cache.has(guildSettings.access_role_id);

		return hasAdminRole ? this.ok() : this.error({ message: 'You do not have permission to use this command.' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		StaffAccess: never;
	}
}
