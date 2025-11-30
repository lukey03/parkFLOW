const ALLOWED_DOMAINS = new Set([
	'imgur.com',
	'i.imgur.com',
	'gyazo.com',
	'i.gyazo.com',
	'prntscr.com',
	'prnt.sc',
	'lightshot.com',
	'discord.com',
	'discordapp.com',
	'cdn.discordapp.com',
	'media.discordapp.net',
	'media.discordapp.com'
]);

const MAX_LENGTHS = {
	description: 500,
	reason: 200,
	actionType: 50,
	unit: 20,
	proof: 2000
};

export class InputValidator {
	public static validateUrl(url: string): { valid: boolean; reason?: string } {
		if (!url || typeof url !== 'string') {
			return { valid: false, reason: 'URL is required and must be a string' };
		}

		if (url.length > MAX_LENGTHS.proof) {
			return { valid: false, reason: `URL too long (max ${MAX_LENGTHS.proof} characters)` };
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return { valid: false, reason: 'Invalid URL format' };
		}

		if (parsedUrl.protocol !== 'https:') {
			return { valid: false, reason: 'Only HTTPS URLs are allowed' };
		}

		const hostname = parsedUrl.hostname.toLowerCase();
		if (!ALLOWED_DOMAINS.has(hostname)) {
			return { valid: false, reason: 'URL domain not allowed. Please use approved image/video hosting services.' };
		}

		return { valid: true };
	}

	public static validateStringLength(value: string, field: keyof typeof MAX_LENGTHS): { valid: boolean; reason?: string } {
		if (!value || typeof value !== 'string') {
			return { valid: false, reason: `${field} is required and must be a string` };
		}

		const maxLength = MAX_LENGTHS[field];
		if (value.length > maxLength) {
			return { valid: false, reason: `${field} too long (max ${maxLength} characters)` };
		}

		const suspiciousPatterns = [/<script/i, /javascript:/i, /data:/i, /vbscript:/i, /onload=/i, /onerror=/i];

		if (suspiciousPatterns.some((pattern) => pattern.test(value))) {
			return { valid: false, reason: `${field} contains potentially malicious content` };
		}

		return { valid: true };
	}

	public static sanitizeString(value: string): string {
		if (!value || typeof value !== 'string') return '';

		return value
			.replace(/[<>'"&]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	public static validateDiscordId(id: string): { valid: boolean; reason?: string } {
		if (!id || typeof id !== 'string') {
			return { valid: false, reason: 'Discord ID is required' };
		}

		if (!/^\d{17,19}$/.test(id)) {
			return { valid: false, reason: 'Invalid Discord ID format' };
		}

		return { valid: true };
	}

	public static validateInteger(value: any, min?: number, max?: number): { valid: boolean; reason?: string; value?: number } {
		if (value === null || value === undefined) {
			return { valid: false, reason: 'Value is required' };
		}

		const num = Number(value);
		if (!Number.isInteger(num)) {
			return { valid: false, reason: 'Value must be an integer' };
		}

		if (min !== undefined && num < min) {
			return { valid: false, reason: `Value must be at least ${min}` };
		}

		if (max !== undefined && num > max) {
			return { valid: false, reason: `Value must be at most ${max}` };
		}

		return { valid: true, value: num };
	}
}
