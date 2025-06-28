interface RateLimitEntry {
	count: number;
	resetTime: number;
}

export class RateLimiter {
	private limits = new Map<string, RateLimitEntry>();
	private readonly maxRequests: number;
	private readonly windowMs: number;

	constructor(maxRequests: number = 10, windowMs: number = 60000) {
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
	}

	public isAllowed(key: string): boolean {
		const now = Date.now();
		const entry = this.limits.get(key);

		if (!entry || now > entry.resetTime) {
			this.limits.set(key, {
				count: 1,
				resetTime: now + this.windowMs
			});
			return true;
		}

		if (entry.count >= this.maxRequests) {
			return false;
		}

		entry.count++;
		return true;
	}

	public getRemainingTime(key: string): number {
		const entry = this.limits.get(key);
		if (!entry) return 0;

		const now = Date.now();
		return Math.max(0, entry.resetTime - now);
	}

	public cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.limits.entries()) {
			if (now > entry.resetTime) {
				this.limits.delete(key);
			}
		}
	}
}

// Global rate limiter for Discord message updates - adjust limits as needed
export const messageUpdateRateLimiter = new RateLimiter(5, 180000);
