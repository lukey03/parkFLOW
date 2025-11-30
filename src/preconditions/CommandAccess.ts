import { AllFlowsPrecondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message, GuildMember } from 'discord.js';
import { Database } from '../lib/database';
import { ErrorHandler } from '../lib/errorHandler';

export class CommandAccessPrecondition extends AllFlowsPrecondition {
	public override chatInputRun(interaction: CommandInteraction) {
		return this.doCheck(interaction.member as GuildMember | null, interaction.user.id, interaction.guildId);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return this.doCheck(interaction.member as GuildMember | null, interaction.user.id, interaction.guildId);
	}

	public override messageRun(_message: Message) {
		return this.error({ message: 'Message commands are not supported.' });
	}

	private doCheck(member: GuildMember | null, userId: string, guildId: string | null) {
		if (!guildId) {
			return this.error({ message: 'This command can only be used in a server.' });
		}

		if (!member) {
			return this.error({ message: 'Could not verify your permissions. Please try again.' });
		}

		const guildSettings = Database.guildSettings.findByGuildId(guildId);
		if (!guildSettings?.admin_role_id) {
			return this.error({ message: 'Server admin access role not configured.' });
		}

		const hasAccessRole = member.roles.cache.has(guildSettings.admin_role_id);

		if (!hasAccessRole) {
			ErrorHandler.logSecurityEvent('Access denied - missing admin role', {
				logger: this.container.logger,
				context: 'CommandAccess precondition',
				userId: userId,
				guildId: guildId
			});
		}

		return hasAccessRole ? this.ok() : this.error({ message: 'You do not have permission to use this command.' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		CommandAccess: never;
	}
}
