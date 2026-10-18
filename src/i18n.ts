import type { MyboxTranslations } from './setting';

export const en: MyboxTranslations = {
	baseDirectory: 'Base directory',
	baseDirectoryDescription:
		'Set the folder in MYBOX that holds this vault. It is created automatically on the first sync.',
	baseDirectoryPlaceholder: 'my-vault/',
	deletePermanently: 'Delete permanently',
	deletePermanentlyDescription:
		'Permanently delete files removed during sync instead of moving them to the MYBOX trash. Permanently deleted files cannot be restored.',
	maxRequestsPerMinute: 'Max API requests per minute',
	maxRequestsPerMinuteDescription:
		'Limit how many MYBOX API requests are sent per minute. MYBOX allows 240 requests per minute for each API and may restrict accounts that send too many requests in a short time.',
	mybox: 'NAVER MYBOX',
	naverId: 'NAVER ID',
	naverIdDescription:
		'Enter the NAVER ID that owns the personal access token. Sync Engine uses it to keep sync records of different accounts apart.',
	naverIdPlaceholder: 'naver-id',
	pleaseConfigureAccount:
		'Please configure the NAVER ID and the MYBOX personal access token first.',
	token: 'Personal access token',
	tokenDescription:
		'Select the secret that holds your MYBOX personal access token. Create a token in MYBOX web under Settings > Account and personal access token management. Tokens expire after 180 days at most.',
};

export const ru: MyboxTranslations = {
	baseDirectory: 'Базовый каталог',
	baseDirectoryDescription:
		'Укажите папку в MYBOX, в которой хранится это хранилище. Она создаётся автоматически при первой синхронизации.',
	baseDirectoryPlaceholder: 'my-vault/',
	deletePermanently: 'Удалять безвозвратно',
	deletePermanentlyDescription:
		'Безвозвратно удалять файлы, удалённые при синхронизации, вместо перемещения в корзину MYBOX. Безвозвратно удалённые файлы нельзя восстановить.',
	maxRequestsPerMinute: 'Макс. запросов API в минуту',
	maxRequestsPerMinuteDescription:
		'Ограничьте количество запросов к API MYBOX в минуту. MYBOX допускает 240 запросов в минуту для каждого API и может ограничить аккаунты, отправляющие слишком много запросов за короткое время.',
	mybox: 'NAVER MYBOX',
	naverId: 'NAVER ID',
	naverIdDescription:
		'Введите NAVER ID, которому принадлежит персональный токен доступа. Sync Engine использует его, чтобы не смешивать записи синхронизации разных аккаунтов.',
	naverIdPlaceholder: 'naver-id',
	pleaseConfigureAccount: 'Сначала настройте NAVER ID и персональный токен доступа MYBOX.',
	token: 'Персональный токен доступа',
	tokenDescription:
		'Выберите секрет, содержащий персональный токен доступа MYBOX. Создайте токен в веб-версии MYBOX: Настройки > Управление аккаунтом и персональными токенами доступа. Срок действия токена — не более 180 дней.',
};

export const zhTW: MyboxTranslations = {
	baseDirectory: '基礎目錄',
	baseDirectoryDescription: '設定 MYBOX 中用來存放此儲存庫的資料夾。系統將於首次同步時自動建立。',
	baseDirectoryPlaceholder: 'my-vault/',
	deletePermanently: '永久刪除',
	deletePermanentlyDescription:
		'同步時刪除的檔案將被永久刪除，而非移至 MYBOX 垃圾桶。永久刪除的檔案無法復原。',
	maxRequestsPerMinute: '每分鐘最大 API 請求數',
	maxRequestsPerMinuteDescription:
		'限制每分鐘傳送至 MYBOX API 的請求數。MYBOX 允許每個 API 每分鐘 240 次請求，短時間內請求過多的帳號可能會被限制使用。',
	mybox: 'NAVER MYBOX',
	naverId: 'NAVER ID',
	naverIdDescription:
		'輸入擁有此個人存取權杖的 NAVER ID。Sync Engine 會以此區分不同帳號的同步記錄。',
	naverIdPlaceholder: 'naver-id',
	pleaseConfigureAccount: '請先設定 NAVER ID 與 MYBOX 個人存取權杖。',
	token: '個人存取權杖',
	tokenDescription:
		'選擇存放 MYBOX 個人存取權杖的密鑰。請在 MYBOX 網頁版的「設定 > 帳號及個人存取權杖管理」中建立權杖。權杖最長有效期為 180 天。',
};

export const zh: MyboxTranslations = {
	baseDirectory: '基础目录',
	baseDirectoryDescription: '设置 MYBOX 中存放此仓库的文件夹。该目录会在首次同步时自动创建。',
	baseDirectoryPlaceholder: 'my-vault/',
	deletePermanently: '永久删除',
	deletePermanentlyDescription:
		'同步时删除的文件将被永久删除，而不是移至 MYBOX 回收站。永久删除的文件无法恢复。',
	maxRequestsPerMinute: '每分钟最大 API 请求数',
	maxRequestsPerMinuteDescription:
		'限制每分钟发送至 MYBOX API 的请求数。MYBOX 允许每个 API 每分钟 240 次请求，短时间内请求过多的账号可能会被限制使用。',
	mybox: 'NAVER MYBOX',
	naverId: 'NAVER ID',
	naverIdDescription:
		'输入拥有该个人访问令牌的 NAVER ID。Sync Engine 用它区分不同账号的同步记录。',
	naverIdPlaceholder: 'naver-id',
	pleaseConfigureAccount: '请先配置 NAVER ID 和 MYBOX 个人访问令牌。',
	token: '个人访问令牌',
	tokenDescription:
		'选择存放 MYBOX 个人访问令牌的密钥。请在 MYBOX 网页版的“设置 > 账号及个人访问令牌管理”中创建令牌。令牌最长有效期为 180 天。',
};
