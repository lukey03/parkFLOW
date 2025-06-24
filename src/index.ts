import './lib/setup';

import { LogLevel, SapphireClient } from '@sapphire/framework';
import { Database } from './lib/database';
import { GatewayIntentBits } from 'discord.js';

const client = new SapphireClient({
	logger: {
		level: LogLevel.Debug
	},
	intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds]
});

const main = async () => {
	try {
		client.logger.info('Initializing database');
		Database.init();
		client.logger.info('Database initialized');

		client.logger.info('Logging in');
		await client.login();
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		await client.destroy();
		process.exit(1);
	}
};

void main();
