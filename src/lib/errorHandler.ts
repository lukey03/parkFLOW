import type { ILogger } from '@sapphire/framework';

interface SafeErrorOptions {
	logger?: ILogger;
	context?: string;
	userId?: string;
	guildId?: string;
}

export class ErrorHandler {
	public static getSafeErrorMessage(error: unknown): string {
		if (process.env.NODE_ENV === 'development') {
			return error instanceof Error ? error.message : String(error);
		}

		// In production, return generic messages to avoid information disclosure
		if (error instanceof Error) {
			switch (true) {
				case error.message.includes('ENOENT'):
					return 'File not found';
				case error.message.includes('EACCES'):
					return 'Permission denied';
				case error.message.includes('ENOSPC'):
					return 'Insufficient disk space';
				case error.message.includes('timeout'):
					return 'Operation timed out';
				case error.message.includes('network'):
				case error.message.includes('fetch'):
					return 'Network error occurred';
				default:
					return 'An unexpected error occurred';
			}
		}

		return 'An unexpected error occurred';
	}

	public static logSecurityEvent(message: string, options: SafeErrorOptions = {}): void {
		const { logger, context, userId, guildId } = options;

		const logMessage = [
			`[SECURITY] ${message}`,
			context ? `Context: ${context}` : '',
			userId ? `User: ${userId}` : '',
			guildId ? `Guild: ${guildId}` : ''
		]
			.filter(Boolean)
			.join(' | ');

		if (logger) {
			logger.warn(logMessage);
		} else {
			console.warn(logMessage);
		}
	}

	public static sanitizeForLog(value: unknown): string {
		if (typeof value === 'string') {
			return value
				.replace(/\b\d{17,19}\b/g, '[DISCORD_ID]')
				.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
				.replace(/\b(?:token|key|secret|password)\s*[=:]\s*\S+/gi, '[REDACTED]')
				.substring(0, 200);
		}

		return String(value).substring(0, 100);
	}
}
