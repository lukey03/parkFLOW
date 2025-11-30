import './lib/setup';

import { LogLevel, SapphireClient } from '@sapphire/framework';
import { Database } from './lib/database';
import { TaskManager } from './lib/tasks';
import { GatewayIntentBits } from 'discord.js';

const client = new SapphireClient({
	logger: {
		level: process.env.NODE_ENV === 'production' ? LogLevel.Info : LogLevel.Debug
	},
	intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds]
});

const gracefulShutdown = async (signal: string) => {
	client.logger.info(`Received ${signal}, shutting down gracefully...`);

	try {
		TaskManager.getInstance().stopPeriodicTasks();
		client.logger.info('Periodic tasks stopped');

		Database.close();
		client.logger.info('Database connection closed');

		await client.destroy();
		client.logger.info('Discord client destroyed');

		process.exit(0);
	} catch (error) {
		client.logger.error('Error during shutdown:', error);
		process.exit(1);
	}
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
