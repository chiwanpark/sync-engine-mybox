import type {
	Context,
	FsWrapperEntry,
	ObsidianLanguageCode,
	RemoteFsEntry,
	RemoteRequestMiddlewareEntry,
	SelectFromContext,
	SettingEntry,
	Settings,
	Translate,
	Translations,
	TranslationResource,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import { digOriginal, prefixWrapper } from '@hesprs/sync-engine-sdk';
import type { MyboxDB } from '@/mybox/fs';
import type { MyboxTranslations } from '@/setting';
import { en, ru, zh, zhTW } from '@/i18n';
import checkConnection from '@/mybox/check-connection';
import MyboxFs from '@/mybox/fs';
import myboxMiddleware from '@/mybox/middleware';
import RateLimiter from '@/mybox/rate-limiter';
import myboxSetting from '@/setting';

export type MyboxSettings = {
	baseDirectory: string;
	maxRequestsPerMinute: number;
	naverId: string;
	token: string;
	deletePermanently: boolean;
};

export default class Mybox {
	private readonly cleanup: Array<() => void> = [];
	private readonly limiter = new RateLimiter(() => this.moduleSettings.maxRequestsPerMinute);

	constructor(
		private readonly ctx: SelectFromContext<{
			translate: Translate<Translations & MyboxTranslations>;
			registerRemoteFs: (id: string, entry: RemoteFsEntry) => () => void;
			app: App;
			memoryDB: MyboxDB;
			registerRemoteFsWrapper: (entry: FsWrapperEntry) => () => void;
			registerRemoteRequestMiddleware: (entry: RemoteRequestMiddlewareEntry) => () => void;
			registerSetting: (entry: SettingEntry) => () => void;
			registerI18n: (lang: ObsidianLanguageCode, translations: TranslationResource) => void;
		}>,
	) {
		if (!this.moduleSettings.baseDirectory)
			this.moduleSettings.baseDirectory = `${ctx.app.vault.getName()}/`;
		ctx.registerI18n('en', en);
		ctx.registerI18n('zh', zh);
		ctx.registerI18n('zh-TW', zhTW);
		ctx.registerI18n('ru', ru);
	}

	readonly moduleSettings: MyboxSettings = {
		baseDirectory: '',
		deletePermanently: false,
		maxRequestsPerMinute: 240,
		naverId: '',
		token: '',
	};

	declare settings: Settings;

	readonly start = () => {
		const {
			translate,
			registerRemoteFs,
			app: { secretStorage },
			memoryDB,
			registerRemoteFsWrapper,
			registerRemoteRequestMiddleware,
			registerSetting,
		} = this.ctx;
		const getToken = () => {
			const { token } = this.moduleSettings;
			const value = token ? secretStorage.getSecret(token) : undefined;
			if (!value) throw new Error(translate('pleaseConfigureAccount'));
			return value;
		};
		const guardAccount = () => {
			if (!this.moduleSettings.naverId) throw new Error(translate('pleaseConfigureAccount'));
			return this.moduleSettings;
		};
		this.cleanup.push(
			registerRemoteFs('mybox', {
				checkConnection,
				instantiate: (request) => new MyboxFs(request, guardAccount(), memoryDB),
				prettyName: () => translate('mybox'),
			}),
			registerRemoteRequestMiddleware({
				apply: (request) => {
					if (this.settings.remoteFs === 'mybox')
						return myboxMiddleware(request, {
							limiter: this.limiter,
							token: getToken(),
						});
				},
				priority: 517,
			}),
			registerRemoteFsWrapper({
				apply: (fs) => {
					if (digOriginal(fs) instanceof MyboxFs)
						return prefixWrapper(fs, this.moduleSettings.baseDirectory);
				},
				priority: 6127,
			}),
			registerSetting({
				apply: myboxSetting(this.ctx as Context, this.moduleSettings),
				priority: 617,
			}),
		);
	};

	readonly dispose = () => {
		this.cleanup.forEach((fn) => fn());
		this.cleanup.length = 0;
		this.limiter.dispose();
	};
}
