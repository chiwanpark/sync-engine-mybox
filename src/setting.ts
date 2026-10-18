import type { MyboxSettings } from '@';
import type { CallableOrObjectTree, LabelDefinition, Translate } from '@hesprs/sync-engine-sdk';
import type { App, SettingGroupItem } from 'obsidian';
import { reactivelyValidate, s } from '@hesprs/sync-engine-sdk';
import { SecretComponent } from 'obsidian';
import { normalizeBaseDir } from '@/shared/path';

export type MyboxTranslations = {
	mybox: string;
	naverId: string;
	naverIdDescription: string;
	naverIdPlaceholder: string;
	token: string;
	tokenDescription: string;
	baseDirectory: string;
	baseDirectoryDescription: string;
	baseDirectoryPlaceholder: string;
	deletePermanently: string;
	deletePermanentlyDescription: string;
	maxRequestsPerMinute: string;
	maxRequestsPerMinuteDescription: string;
	pleaseConfigureAccount: string;
};

function parsePositiveInteger(value: string): number | undefined {
	const parsed = Number(value.trim());
	if (Number.isInteger(parsed) && parsed > 0) return parsed;
}

export default function myboxSetting(
	{
		translate,
		saveSettings,
		app,
		matchLabel,
		speedLabel,
	}: {
		translate: Translate<MyboxTranslations>;
		saveSettings: () => Promise<void>;
		app: App;
		matchLabel: () => LabelDefinition;
		speedLabel: () => LabelDefinition;
	},
	settings: MyboxSettings,
): CallableOrObjectTree {
	return {
		617: s(
			(self) => ({
				heading: translate('mybox'),
				items: Object.values(self).map((node) => node(node) as SettingGroupItem),
				type: 'group',
			}),
			{
				1000: s(() => ({
					desc: translate('tokenDescription'),
					name: translate('token'),
					render: (setting) => {
						setting.addComponent((element) =>
							new SecretComponent(app, element)
								.setValue(settings.token)
								.onChange((token) => {
									settings.token = token ?? '';
									void saveSettings();
								}),
						);
					},
				})),
				2000: s(() => ({
					desc: translate('baseDirectoryDescription'),
					labels: [matchLabel()],
					name: translate('baseDirectory'),
					render: (setting) => {
						setting.addText((text) => {
							text.setPlaceholder(translate('baseDirectoryPlaceholder'))
								.setValue(settings.baseDirectory)
								.inputEl.addEventListener('blur', () => {
									const normalized = normalizeBaseDir(text.getValue().trim());
									text.setValue(normalized);
									settings.baseDirectory = normalized;
									void saveSettings();
								});
						});
					},
				})),
				2500: s(() => ({
					desc: translate('deletePermanentlyDescription'),
					name: translate('deletePermanently'),
					render: (setting) => {
						setting.addToggle((toggle) =>
							toggle.setValue(settings.deletePermanently).onChange((value) => {
								settings.deletePermanently = value;
								void saveSettings();
							}),
						);
					},
				})),
				3000: s(() => ({
					desc: translate('maxRequestsPerMinuteDescription'),
					labels: [speedLabel()],
					name: translate('maxRequestsPerMinute'),
					render: (setting) => {
						setting.addText((text) => {
							text.setValue(String(settings.maxRequestsPerMinute));
							text.inputEl.type = 'number';
							reactivelyValidate<number>({
								onSave: (value) => {
									settings.maxRequestsPerMinute = value;
									void saveSettings();
								},
								parse: parsePositiveInteger,
								text,
							});
						});
					},
				})),
				500: s(() => ({
					desc: translate('naverIdDescription'),
					name: translate('naverId'),
					render: (setting) => {
						setting.addText((text) => {
							text.setPlaceholder(translate('naverIdPlaceholder'))
								.setValue(settings.naverId)
								.inputEl.addEventListener('blur', () => {
									const naverId = text.getValue().trim();
									text.setValue(naverId);
									settings.naverId = naverId;
									void saveSettings();
								});
						});
					},
				})),
			},
		),
	};
}
