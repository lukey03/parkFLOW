import type { SapphireClient } from '@sapphire/framework';

export class RobloxUtils {
	static async getRobloxAvatar(discordId: string, guildId: string, client: SapphireClient, size: '50x50' | '150x150' = '150x150'): Promise<string> {
		try {
			const guild = await client.guilds.fetch(guildId);
			const member = await guild.members.fetch(discordId);
			const nickname = member.nickname || member.user.username;

			let robloxId = '1';

			try {
				const usernameResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						usernames: [nickname],
						excludeBannedUsers: true
					})
				});

				const usernameData = (await usernameResponse.json()) as any;
				if (usernameData.data && Array.isArray(usernameData.data) && usernameData.data.length > 0) {
					robloxId = usernameData.data[0].id.toString();
				} else {
					const robloxIdMatch = nickname.match(/(\d+)/);
					if (robloxIdMatch) {
						robloxId = robloxIdMatch[1];
					}
				}
			} catch {
				const robloxIdMatch = nickname.match(/(\d+)/);
				if (robloxIdMatch) {
					robloxId = robloxIdMatch[1];
				}
			}

			const apiUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=${size}&format=Png&isCircular=false`;
			const response = await fetch(apiUrl);
			const data = (await response.json()) as any;

			if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].imageUrl) {
				return data.data[0].imageUrl;
			}

			const fallbackResponse = await fetch(
				`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=1&size=${size}&format=Png&isCircular=false`
			);
			const fallbackData = (await fallbackResponse.json()) as any;
			return (
				fallbackData.data?.[0]?.imageUrl ||
				'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-0000000000000001-Png/150/150/AvatarHeadshot/Png/noFilter'
			);
		} catch (error) {
			return 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-0000000000000001-Png/150/150/AvatarHeadshot/Png/noFilter';
		}
	}

	static async getRobloxUserId(username: string): Promise<string | null> {
		try {
			const response = await fetch('https://users.roblox.com/v1/usernames/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					usernames: [username],
					excludeBannedUsers: true
				})
			});

			const data = (await response.json()) as any;
			if (data.data && Array.isArray(data.data) && data.data.length > 0) {
				return data.data[0].id.toString();
			}

			return null;
		} catch {
			return null;
		}
	}
}
