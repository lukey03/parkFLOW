import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface BrandingConfig {
	application: {
		name: string;
		database_filename: string;
		shift_cycle_start_day?: number;
	};
	jurisdiction: {
		name: string;
		employee_term: string;
		employee_plural: string;
		department_term: string;
		shift_term: string;
		active_term: string;
	};
	units: Array<{
		name: string;
		code: string;
	}>;
	ui_text: {
		active_shifts_header: string;
		no_active_message: string;
		active_count_message: string;
		shift_actions: {
			started: string;
			ended: string;
			break_started: string;
			break_ended: string;
			force_ended: string;
			force_started: string;
			force_break_ended: string;
			force_break_started: string;
		};
		commands: {
			ping_header: string;
			server_setup_description: string;
			shift_main_description: string;
			shift_self_description: string;
			shift_department_description: string;
			shift_toggle_description: string;
			shift_adjust_description: string;
			shift_reset_description: string;
			shift_force_toggle_description: string;
			shift_view_description: string;
		};
		time_labels: {
			total_logged_time: string;
			effective_work_time: string;
			total_break_time: string;
			raw_time: string;
			last_shift: string;
			all_shifts: string;
			department_overview: string;
		};
	};
}

class ConfigManager {
	private static instance: ConfigManager;
	private config!: BrandingConfig;

	private constructor() {
		this.loadConfig();
	}

	public static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	private loadConfig(): void {
		try {
			const configPath = join(process.cwd(), 'config', 'branding.json');
			const configData = readFileSync(configPath, 'utf-8');
			this.config = JSON.parse(configData);
		} catch (error) {
			console.error('Failed to load branding configuration. Please ensure config/branding.json exists and is valid.');
			if (process.env.NODE_ENV === 'development') {
				console.error('Development error details:', error);
			}
			process.exit(1);
		}
	}

	public get app(): BrandingConfig['application'] {
		return this.config.application;
	}

	public get org(): BrandingConfig['jurisdiction'] {
		return this.config.jurisdiction;
	}

	public get units(): BrandingConfig['units'] {
		return this.config.units;
	}

	public get ui(): BrandingConfig['ui_text'] {
		return this.config.ui_text;
	}

	public get shiftCycleStartDay(): number {
		return this.config.application.shift_cycle_start_day ?? 1;
	}

	public formatText(template: string, variables: Record<string, string | number> = {}): string {
		let formatted = template;

		const defaultVars = {
			app_name: this.config.application.name,
			jurisdiction_name: this.config.jurisdiction.name,
			employee_term: this.config.jurisdiction.employee_term,
			employee_plural: this.config.jurisdiction.employee_plural,
			department_term: this.config.jurisdiction.department_term,
			department_term_title: this.capitalize(this.config.jurisdiction.department_term),
			shift_term: this.config.jurisdiction.shift_term,
			shift_term_title: this.capitalize(this.config.jurisdiction.shift_term),
			active_term: this.config.jurisdiction.active_term
		};

		const allVars = { ...defaultVars, ...variables };

		for (const [key, value] of Object.entries(allVars)) {
			formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), String(value));
		}

		return formatted;
	}

	public capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	public getActiveSummaryText(count: number): string {
		if (count === 0) {
			return this.formatText(this.config.ui_text.no_active_message);
		}

		const pluralSuffix = count === 1 ? '' : 's';
		return this.formatText(this.config.ui_text.active_count_message, {
			count,
			plural_suffix: pluralSuffix
		});
	}

	public getUnitNameFromCode(code: string): string {
		const unit = this.config.units.find((u) => u.code === code);
		return unit ? unit.name : code;
	}
}

export const Config = ConfigManager.getInstance();
