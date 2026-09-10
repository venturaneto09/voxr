// SPDX-License-Identifier: AGPL-3.0-or-later

type ConfigPathKey = string | number;
type ConfigObject = Record<string, unknown>;
type ConfigContainer = ConfigObject | Array<unknown>;

type EnvValueParser = (raw: string) => unknown;

interface NamedEnvOverride {
	path: Array<ConfigPathKey>;
	parse?: EnvValueParser;
}

const NAMED_VOXR_ENV_OVERRIDES: Record<string, NamedEnvOverride> = {
	VOXR_ENV: {path: ['env']},
	VOXR_BASE_DOMAIN: {path: ['domain', 'base_domain']},
	VOXR_PUBLIC_ORIGIN: {path: ['domain', 'public_origin']},
	VOXR_PUBLIC_SCHEME: {path: ['domain', 'public_scheme']},
	VOXR_INTERNAL_SCHEME: {path: ['domain', 'internal_scheme']},
	VOXR_PUBLIC_PORT: {path: ['domain', 'public_port'], parse: parseInteger},
	VOXR_STATIC_CDN_DOMAIN: {path: ['domain', 'static_cdn_domain']},
	VOXR_INVITE_DOMAIN: {path: ['domain', 'invite_domain']},
	VOXR_GIFT_DOMAIN: {path: ['domain', 'gift_domain']},
	VOXR_API_ENDPOINT: {path: ['endpoint_overrides', 'api']},
	VOXR_API_CLIENT_ENDPOINT: {path: ['endpoint_overrides', 'api_client']},
	VOXR_APP_ENDPOINT: {path: ['endpoint_overrides', 'app']},
	VOXR_GATEWAY_ENDPOINT: {path: ['endpoint_overrides', 'gateway']},
	VOXR_MEDIA_ENDPOINT: {path: ['endpoint_overrides', 'media']},
	VOXR_STATIC_CDN_ENDPOINT: {path: ['endpoint_overrides', 'static_cdn']},
	VOXR_ADMIN_ENDPOINT: {path: ['endpoint_overrides', 'admin']},
	VOXR_DOCS_ENDPOINT: {path: ['endpoint_overrides', 'docs']},
	VOXR_MARKETING_ENDPOINT: {path: ['endpoint_overrides', 'marketing']},
	VOXR_INVITE_ENDPOINT: {path: ['endpoint_overrides', 'invite']},
	VOXR_GIFT_ENDPOINT: {path: ['endpoint_overrides', 'gift']},
	VOXR_TRUST_CLIENT_IP_HEADER: {path: ['proxy', 'trust_client_ip_header'], parse: parseEnvValue},
	VOXR_CLIENT_IP_HEADER_NAME: {path: ['proxy', 'client_ip_header']},
	VOXR_CASSANDRA_HOSTS: {path: ['database', 'cassandra', 'hosts'], parse: parseCsv},
	VOXR_CASSANDRA_PORT: {path: ['database', 'cassandra', 'port'], parse: parseInteger},
	VOXR_CASSANDRA_KEYSPACE: {path: ['database', 'cassandra', 'keyspace']},
	VOXR_CASSANDRA_LOCAL_DC: {path: ['database', 'cassandra', 'local_dc']},
	VOXR_CASSANDRA_USERNAME: {path: ['database', 'cassandra', 'username']},
	VOXR_CASSANDRA_PASSWORD: {path: ['database', 'cassandra', 'password']},
	VOXR_POSTGRES_URL: {path: ['database', 'postgres', 'url']},
	VOXR_POSTGRES_HOST: {path: ['database', 'postgres', 'host']},
	VOXR_POSTGRES_PORT: {path: ['database', 'postgres', 'port'], parse: parseInteger},
	VOXR_POSTGRES_DATABASE: {path: ['database', 'postgres', 'database']},
	VOXR_POSTGRES_USERNAME: {path: ['database', 'postgres', 'username']},
	VOXR_POSTGRES_PASSWORD: {path: ['database', 'postgres', 'password']},
	VOXR_POSTGRES_SSL: {path: ['database', 'postgres', 'ssl'], parse: parseEnvValue},
	VOXR_POSTGRES_SSL_CA: {path: ['database', 'postgres', 'ssl_ca']},
	VOXR_POSTGRES_MAX_CONNECTIONS: {path: ['database', 'postgres', 'max_connections'], parse: parseInteger},
	VOXR_POSTGRES_KV_TABLE: {path: ['database', 'postgres', 'kv_table']},
	VOXR_POSTGRES_PREPARED_STATEMENTS: {path: ['database', 'postgres', 'prepared_statements'], parse: parseEnvValue},
	VOXR_DATABASE_BACKEND: {path: ['database', 'backend']},
	VOXR_KV_URL: {path: ['internal', 'kv']},
	VOXR_KV_PROVIDER: {path: ['internal', 'kv_provider']},
	VOXR_KV_MODE: {path: ['internal', 'kv_mode']},
	VOXR_INTERNAL_API_ENDPOINT: {path: ['internal', 'api']},
	VOXR_INTERNAL_GATEWAY_ENDPOINT: {path: ['internal', 'gateway']},
	VOXR_INTERNAL_MEDIA_PROXY_ENDPOINT: {path: ['internal', 'media_proxy']},
	VOXR_S3_ENDPOINT: {path: ['s3', 'endpoint']},
	VOXR_S3_PUBLIC_ENDPOINT: {path: ['s3', 'presigned_url_base']},
	VOXR_S3_FORCE_PATH_STYLE: {path: ['s3', 'force_path_style'], parse: parseEnvValue},
	VOXR_S3_REGION: {path: ['s3', 'region']},
	VOXR_S3_ACCESS_KEY_ID: {path: ['s3', 'access_key_id']},
	VOXR_S3_SECRET_ACCESS_KEY: {path: ['s3', 'secret_access_key']},
	VOXR_S3_BUCKET_CDN: {path: ['s3', 'buckets', 'cdn']},
	VOXR_S3_BUCKET_UPLOADS: {path: ['s3', 'buckets', 'uploads']},
	VOXR_S3_BUCKET_DOWNLOADS: {path: ['s3', 'buckets', 'downloads']},
	VOXR_S3_BUCKET_REPORTS: {path: ['s3', 'buckets', 'reports']},
	VOXR_S3_BUCKET_HARVESTS: {path: ['s3', 'buckets', 'harvests']},
	VOXR_S3_DOWNLOADS_ENDPOINT: {path: ['s3_downloads', 'endpoint']},
	VOXR_S3_DOWNLOADS_PUBLIC_ENDPOINT: {path: ['s3_downloads', 'presigned_url_base']},
	VOXR_S3_DOWNLOADS_FORCE_PATH_STYLE: {path: ['s3_downloads', 'force_path_style'], parse: parseEnvValue},
	VOXR_S3_DOWNLOADS_REGION: {path: ['s3_downloads', 'region']},
	VOXR_S3_DOWNLOADS_ACCESS_KEY_ID: {path: ['s3_downloads', 'access_key_id']},
	VOXR_S3_DOWNLOADS_SECRET_ACCESS_KEY: {path: ['s3_downloads', 'secret_access_key']},
	VOXR_NATS_URL: {path: ['services', 'nats', 'core_url']},
	VOXR_NATS_JETSTREAM_URL: {path: ['services', 'nats', 'jetstream_url']},
	VOXR_NATS_AUTH_TOKEN: {path: ['services', 'nats', 'auth_token']},
	VOXR_API_PORT: {path: ['services', 'api', 'port'], parse: parseInteger},
	VOXR_API_HEADERS_TIMEOUT_MS: {path: ['services', 'api', 'headers_timeout_ms'], parse: parseInteger},
	VOXR_API_REQUEST_TIMEOUT_MS: {path: ['services', 'api', 'request_timeout_ms'], parse: parseInteger},
	VOXR_API_MAX_INFLIGHT_REQUESTS: {path: ['services', 'api', 'max_inflight_requests'], parse: parseInteger},
	VOXR_API_IP_BAN_EXEMPT_IPS: {path: ['services', 'api', 'ip_ban_exempt_ips'], parse: parseCsv},
	VOXR_API_DESKTOP_GITHUB_REDIRECT_COUNTRIES: {
		path: ['services', 'api', 'desktop_github_redirect_countries'],
		parse: parseCsv,
	},
	VOXR_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_attachment_uploads_enabled'],
		parse: parseEnvValue,
	},
	VOXR_API_PRESIGNED_DOWNLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_downloads_enabled'],
		parse: parseEnvValue,
	},
	VOXR_API_PRESIGNED_HARVEST_DOWNLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_harvest_downloads_enabled'],
		parse: parseEnvValue,
	},
	VOXR_API_WORKER_MODE: {path: ['services', 'api', 'worker', 'mode']},
	VOXR_API_WORKER_LANE: {path: ['services', 'api', 'worker', 'lane']},
	VOXR_API_WORKER_TASK: {path: ['services', 'api', 'worker', 'task']},
	VOXR_API_WORKER_ENABLE_CRON_SCHEDULER: {
		path: ['services', 'api', 'worker', 'enable_cron_scheduler'],
		parse: parseEnvValue,
	},
	VOXR_API_WORKER_ENABLE_VOICE_RECONCILIATION: {
		path: ['services', 'api', 'worker', 'enable_voice_reconciliation'],
		parse: parseEnvValue,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_INTERVAL_MS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'interval_ms'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_STAGGER_DELAY_MS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'stagger_delay_ms'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_LOCK_TTL_SECONDS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'lock_ttl_seconds'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_CADENCE_TTL_SECONDS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'cadence_ttl_seconds'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_GATEWAY_ONLY_GRACE_MS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'gateway_only_grace_ms'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_VOICE_RECONCILIATION_LIVEKIT_ONLY_GRACE_MS: {
		path: ['services', 'api', 'worker', 'voice_reconciliation', 'livekit_only_grace_ms'],
		parse: parseInteger,
	},
	VOXR_API_WORKER_LANE_CONCURRENCY_OVERRIDES: {
		path: ['services', 'api', 'worker', 'lane_concurrency_overrides'],
		parse: parseEnvValue,
	},
	VOXR_API_UNFURL_IGNORED_HOSTS: {path: ['services', 'api', 'unfurl_ignored_hosts'], parse: parseCsv},
	VOXR_API_EMBEDS_OEMBED_HTML_ENABLED: {
		path: ['services', 'api', 'embeds', 'oembed_html_enabled'],
		parse: parseEnvValue,
	},
	VOXR_API_EMBEDS_OEMBED_HTML_ALLOW_UNTRUSTED_ON_SELF_HOSTED: {
		path: ['services', 'api', 'embeds', 'oembed_html_allow_untrusted_on_self_hosted'],
		parse: parseEnvValue,
	},
	VOXR_API_EMBEDS_OEMBED_HTML_ALLOWED_HOSTS: {
		path: ['services', 'api', 'embeds', 'oembed_html_allowed_hosts'],
		parse: parseCsv,
	},
	VOXR_API_EMBEDS_CACHE_DEFAULT_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_default_ttl_seconds'],
		parse: parseInteger,
	},
	VOXR_API_EMBEDS_CACHE_MAX_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_max_ttl_seconds'],
		parse: parseInteger,
	},
	VOXR_API_EMBEDS_CACHE_MIN_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_min_ttl_seconds'],
		parse: parseInteger,
	},
	VOXR_API_EMBEDS_CACHE_RESPECT_REMOTE_TTL: {
		path: ['services', 'api', 'embeds', 'cache_respect_remote_ttl'],
		parse: parseEnvValue,
	},
	VOXR_API_CONTENT_MODERATION_NSFW_THRESHOLD: {
		path: ['services', 'api', 'content_moderation', 'nsfw_threshold'],
		parse: parseEnvValue,
	},
	VOXR_MEDIA_PROXY_HOST: {path: ['services', 'media_proxy', 'host']},
	VOXR_MEDIA_PROXY_PORT: {path: ['services', 'media_proxy', 'port'], parse: parseInteger},
	VOXR_MEDIA_PROXY_SECRET_KEY: {path: ['services', 'media_proxy', 'secret_key']},
	VOXR_MEDIA_PROXY_MODE: {path: ['services', 'media_proxy', 'mode']},
	VOXR_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: {path: ['services', 'media_proxy', 'upload_relay', 'endpoint']},
	VOXR_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: {path: ['services', 'media_proxy', 'upload_relay', 'secret_base64']},
	VOXR_MEDIA_PROXY_UPLOAD_RELAY_MAX_BODY_BYTES: {
		path: ['services', 'media_proxy', 'upload_relay', 'max_body_bytes'],
		parse: parseInteger,
	},
	VOXR_MEDIA_PROXY_UPLOAD_RELAY_TOKEN_TTL_SECS: {
		path: ['services', 'media_proxy', 'upload_relay', 'token_ttl_secs'],
		parse: parseInteger,
	},
	VOXR_MEDIA_PROXY_UPLOAD_RELAY_KEEP_DIRECT_COUNTRIES: {
		path: ['services', 'media_proxy', 'upload_relay', 'keep_direct_countries'],
		parse: parseCsv,
	},
	VOXR_ADMIN_PORT: {path: ['services', 'admin', 'port'], parse: parseInteger},
	VOXR_ADMIN_BASE_PATH: {path: ['services', 'admin', 'base_path']},
	VOXR_ADMIN_SECRET_KEY_BASE: {path: ['services', 'admin', 'secret_key_base']},
	VOXR_ADMIN_OAUTH_CLIENT_SECRET: {path: ['services', 'admin', 'oauth_client_secret']},
	VOXR_MARKETING_HOST: {path: ['services', 'marketing', 'host']},
	VOXR_MARKETING_PORT: {path: ['services', 'marketing', 'port'], parse: parseInteger},
	VOXR_MARKETING_BASE_PATH: {path: ['services', 'marketing', 'base_path']},
	VOXR_MARKETING_SECRET_KEY_BASE: {path: ['services', 'marketing', 'secret_key_base']},
	VOXR_APP_PROXY_PORT: {path: ['services', 'app_proxy', 'port'], parse: parseInteger},
	VOXR_STATIC_DIR: {path: ['services', 'app_proxy', 'assets_dir']},
	VOXR_GATEWAY_PORT: {path: ['services', 'gateway', 'port'], parse: parseInteger},
	VOXR_GATEWAY_ROLE: {path: ['services', 'gateway', 'gateway_role']},
	VOXR_GATEWAY_MEDIA_PROXY_ENDPOINT: {path: ['services', 'gateway', 'media_proxy_endpoint']},
	VOXR_GATEWAY_API_RPC_ENDPOINT: {path: ['services', 'gateway', 'api_rpc_endpoint']},
	VOXR_GATEWAY_RPC_AUTH_TOKEN: {path: ['services', 'gateway', 'rpc_auth_token']},
	VOXR_GATEWAY_LOGGER_LEVEL: {path: ['services', 'gateway', 'logger_level']},
	VOXR_GATEWAY_HTTP_FAILURE_THRESHOLD: {
		path: ['services', 'gateway', 'gateway_http_failure_threshold'],
		parse: parseInteger,
	},
	VOXR_GATEWAY_HTTP_RECOVERY_TIMEOUT_MS: {
		path: ['services', 'gateway', 'gateway_http_recovery_timeout_ms'],
		parse: parseInteger,
	},
	VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY: {
		path: ['services', 'gateway', 'gateway_http_rpc_max_concurrency'],
		parse: parseInteger,
	},
	VOXR_GATEWAY_NATS_RPC_MAX_HANDLERS: {
		path: ['services', 'gateway', 'gateway_nats_rpc_max_handlers'],
		parse: parseInteger,
	},
	VOXR_GATEWAY_SHUTDOWN_DRAIN_WAIT_MS: {
		path: ['services', 'gateway', 'shutdown_drain_wait_ms'],
		parse: parseInteger,
	},
	VOXR_GATEWAY_CLUSTER_ENABLED: {path: ['services', 'gateway', 'cluster_enabled'], parse: parseEnvValue},
	VOXR_GATEWAY_CLUSTER_DISCOVERY_DNS_NAME: {path: ['services', 'gateway', 'cluster_discovery_dns_name']},
	VOXR_GATEWAY_CLUSTER_DISCOVERY_NODE_BASENAME: {
		path: ['services', 'gateway', 'cluster_discovery_node_basename'],
	},
	VOXR_GATEWAY_CLUSTER_DISCOVERY_POLL_INTERVAL_MS: {
		path: ['services', 'gateway', 'cluster_discovery_poll_interval_ms'],
		parse: parseInteger,
	},
	VOXR_SUDO_MODE_SECRET: {path: ['auth', 'sudo_mode_secret']},
	VOXR_CONNECTION_INITIATION_SECRET: {path: ['auth', 'connection_initiation_secret']},
	VOXR_SSO_ALLOW_PRIVATE_ADDRESSES: {path: ['auth', 'sso_allow_private_addresses'], parse: parseEnvValue},
	VOXR_VAPID_PUBLIC_KEY: {path: ['auth', 'vapid', 'public_key']},
	VOXR_VAPID_PRIVATE_KEY: {path: ['auth', 'vapid', 'private_key']},
	VOXR_VAPID_EMAIL: {path: ['auth', 'vapid', 'email']},
	VOXR_PASSKEY_RP_NAME: {path: ['auth', 'passkeys', 'rp_name']},
	VOXR_PASSKEY_RP_ID: {path: ['auth', 'passkeys', 'rp_id']},
	VOXR_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: {
		path: ['auth', 'passkeys', 'additional_allowed_origins'],
		parse: parseCsv,
	},
	VOXR_AUTH_BLUESKY_ENABLED: {path: ['auth', 'bluesky', 'enabled'], parse: parseEnvValue},
	VOXR_AUTH_BLUESKY_CLIENT_NAME: {path: ['auth', 'bluesky', 'client_name']},
	VOXR_AUTH_BLUESKY_CLIENT_URI: {path: ['auth', 'bluesky', 'client_uri']},
	VOXR_AUTH_BLUESKY_LOGO_URI: {path: ['auth', 'bluesky', 'logo_uri']},
	VOXR_AUTH_BLUESKY_TOS_URI: {path: ['auth', 'bluesky', 'tos_uri']},
	VOXR_AUTH_BLUESKY_POLICY_URI: {path: ['auth', 'bluesky', 'policy_uri']},
	VOXR_AUTH_BLUESKY_KEYS: {path: ['auth', 'bluesky', 'keys'], parse: parseEnvValue},
	VOXR_EMAIL_ENABLED: {path: ['integrations', 'email', 'enabled'], parse: parseEnvValue},
	VOXR_EMAIL_PROVIDER: {path: ['integrations', 'email', 'provider']},
	VOXR_EMAIL_FROM_EMAIL: {path: ['integrations', 'email', 'from_email']},
	VOXR_EMAIL_FROM_NAME: {path: ['integrations', 'email', 'from_name']},
	VOXR_EMAIL_APP_BASE_URL: {path: ['integrations', 'email', 'app_base_url']},
	VOXR_EMAIL_WEBHOOK_SECRET: {path: ['integrations', 'email', 'webhook_secret']},
	VOXR_EMAIL_SMTP_HOST: {path: ['integrations', 'email', 'smtp', 'host']},
	VOXR_EMAIL_SMTP_PORT: {path: ['integrations', 'email', 'smtp', 'port'], parse: parseInteger},
	VOXR_EMAIL_SMTP_USERNAME: {path: ['integrations', 'email', 'smtp', 'username']},
	VOXR_EMAIL_SMTP_PASSWORD: {path: ['integrations', 'email', 'smtp', 'password']},
	VOXR_EMAIL_SMTP_SECURE: {path: ['integrations', 'email', 'smtp', 'secure'], parse: parseEnvValue},
	VOXR_SMS_ENABLED: {path: ['integrations', 'sms', 'enabled'], parse: parseEnvValue},
	VOXR_SMS_ACCOUNT_SID: {path: ['integrations', 'sms', 'account_sid']},
	VOXR_SMS_AUTH_TOKEN: {path: ['integrations', 'sms', 'auth_token']},
	VOXR_SMS_VERIFY_SERVICE_SID: {path: ['integrations', 'sms', 'verify_service_sid']},
	VOXR_SMS_INBOUND_CHALLENGE_NUMBER: {path: ['integrations', 'sms', 'inbound_challenge_number']},
	VOXR_SMS_INBOUND_WEBHOOK_AUTH_TOKEN: {path: ['integrations', 'sms', 'inbound_webhook_auth_token']},
	VOXR_SMS_INBOUND_WEBHOOK_PUBLIC_URL: {path: ['integrations', 'sms', 'inbound_webhook_public_url']},
	VOXR_CAPTCHA_ENABLED: {path: ['integrations', 'captcha', 'enabled'], parse: parseEnvValue},
	VOXR_CAPTCHA_PROVIDER: {path: ['integrations', 'captcha', 'provider']},
	VOXR_CAPTCHA_HCAPTCHA_SITE_KEY: {path: ['integrations', 'captcha', 'hcaptcha', 'site_key']},
	VOXR_CAPTCHA_HCAPTCHA_SECRET_KEY: {path: ['integrations', 'captcha', 'hcaptcha', 'secret_key']},
	VOXR_CAPTCHA_TURNSTILE_SITE_KEY: {path: ['integrations', 'captcha', 'turnstile', 'site_key']},
	VOXR_CAPTCHA_TURNSTILE_SECRET_KEY: {path: ['integrations', 'captcha', 'turnstile', 'secret_key']},
	VOXR_LIVEKIT_ENABLED: {path: ['integrations', 'voice', 'enabled'], parse: parseEnvValue},
	VOXR_LIVEKIT_API_KEY: {path: ['integrations', 'voice', 'api_key']},
	VOXR_LIVEKIT_API_SECRET: {path: ['integrations', 'voice', 'api_secret']},
	VOXR_LIVEKIT_URL: {path: ['integrations', 'voice', 'url']},
	VOXR_LIVEKIT_INTERNAL_URL: {path: ['integrations', 'voice', 'internal_url']},
	VOXR_LIVEKIT_WEBHOOK_URL: {path: ['integrations', 'voice', 'webhook_url']},
	VOXR_LIVEKIT_DEFAULT_REGION: {path: ['integrations', 'voice', 'default_region'], parse: parseEnvValue},
	VOXR_SEARCH_ENGINE: {path: ['integrations', 'search', 'engine']},
	VOXR_SEARCH_URL: {path: ['integrations', 'search', 'url']},
	VOXR_SEARCH_API_KEY: {path: ['integrations', 'search', 'api_key']},
	VOXR_SEARCH_USERNAME: {path: ['integrations', 'search', 'username']},
	VOXR_SEARCH_PASSWORD: {path: ['integrations', 'search', 'password']},
	VOXR_SEARCH_TLS_REJECT_UNAUTHORIZED: {
		path: ['integrations', 'search', 'tls_reject_unauthorized'],
		parse: parseEnvValue,
	},
	VOXR_STRIPE_ENABLED: {path: ['integrations', 'stripe', 'enabled'], parse: parseEnvValue},
	VOXR_STRIPE_SECRET_KEY: {path: ['integrations', 'stripe', 'secret_key']},
	VOXR_STRIPE_WEBHOOK_SECRET: {path: ['integrations', 'stripe', 'webhook_secret']},
	VOXR_STRIPE_PRICES: {path: ['integrations', 'stripe', 'prices'], parse: parseEnvValue},
	VOXR_STRIPE_PRICE_MONTHLY_USD: {path: ['integrations', 'stripe', 'prices', 'monthly_usd']},
	VOXR_STRIPE_PRICE_MONTHLY_EUR: {path: ['integrations', 'stripe', 'prices', 'monthly_eur']},
	VOXR_STRIPE_PRICE_MONTHLY_BRL: {path: ['integrations', 'stripe', 'prices', 'monthly_brl']},
	VOXR_STRIPE_PRICE_MONTHLY_INR: {path: ['integrations', 'stripe', 'prices', 'monthly_inr']},
	VOXR_STRIPE_PRICE_MONTHLY_PLN: {path: ['integrations', 'stripe', 'prices', 'monthly_pln']},
	VOXR_STRIPE_PRICE_MONTHLY_TRY: {path: ['integrations', 'stripe', 'prices', 'monthly_try']},
	VOXR_STRIPE_PRICE_YEARLY_USD: {path: ['integrations', 'stripe', 'prices', 'yearly_usd']},
	VOXR_STRIPE_PRICE_YEARLY_EUR: {path: ['integrations', 'stripe', 'prices', 'yearly_eur']},
	VOXR_STRIPE_PRICE_YEARLY_BRL: {path: ['integrations', 'stripe', 'prices', 'yearly_brl']},
	VOXR_STRIPE_PRICE_YEARLY_INR: {path: ['integrations', 'stripe', 'prices', 'yearly_inr']},
	VOXR_STRIPE_PRICE_YEARLY_PLN: {path: ['integrations', 'stripe', 'prices', 'yearly_pln']},
	VOXR_STRIPE_PRICE_YEARLY_TRY: {path: ['integrations', 'stripe', 'prices', 'yearly_try']},
	VOXR_STRIPE_PRICE_VISIONARY_USD: {path: ['integrations', 'stripe', 'prices', 'visionary_usd']},
	VOXR_STRIPE_PRICE_VISIONARY_EUR: {path: ['integrations', 'stripe', 'prices', 'visionary_eur']},
	VOXR_STRIPE_PRICE_GIFT_VISIONARY_USD: {path: ['integrations', 'stripe', 'prices', 'gift_visionary_usd']},
	VOXR_STRIPE_PRICE_GIFT_VISIONARY_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_visionary_eur']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_USD: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_usd']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_eur']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_BRL: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_brl']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_INR: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_inr']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_PLN: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_pln']},
	VOXR_STRIPE_PRICE_GIFT_1_MONTH_TRY: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_try']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_USD: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_usd']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_eur']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_BRL: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_brl']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_INR: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_inr']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_PLN: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_pln']},
	VOXR_STRIPE_PRICE_GIFT_1_YEAR_TRY: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_try']},
	VOXR_NCMEC_ENABLED: {path: ['integrations', 'ncmec', 'enabled'], parse: parseEnvValue},
	VOXR_NCMEC_BASE_URL: {path: ['integrations', 'ncmec', 'base_url']},
	VOXR_NCMEC_USERNAME: {path: ['integrations', 'ncmec', 'username']},
	VOXR_NCMEC_PASSWORD: {path: ['integrations', 'ncmec', 'password']},
	VOXR_NCMEC_REPORTER_EMAIL: {path: ['integrations', 'ncmec', 'reporter_email']},
	VOXR_CLAMAV_ENABLED: {path: ['integrations', 'clamav', 'enabled'], parse: parseEnvValue},
	VOXR_CLAMAV_HOST: {path: ['integrations', 'clamav', 'host']},
	VOXR_CLAMAV_PORT: {path: ['integrations', 'clamav', 'port'], parse: parseInteger},
	VOXR_CLAMAV_FAIL_OPEN: {path: ['integrations', 'clamav', 'fail_open'], parse: parseEnvValue},
	VOXR_KLIPY_API_KEY: {path: ['integrations', 'klipy', 'api_key']},
	VOXR_YOUTUBE_API_KEY: {path: ['integrations', 'youtube', 'api_key']},
	VOXR_BUNNY_PURGE_ENABLED: {path: ['integrations', 'bunny', 'purge_enabled'], parse: parseEnvValue},
	VOXR_BLOCKLIST_FEEDS_ENABLED: {path: ['integrations', 'blocklist_feeds', 'enabled'], parse: parseEnvValue},
	VOXR_BUNNY_API_KEY: {path: ['integrations', 'bunny', 'api_key']},
	VOXR_BUNNY_PULL_ZONE_ID: {path: ['integrations', 'bunny', 'pull_zone_id'], parse: parseInteger},
	VOXR_RISK_INTEGRATION_ENABLED: {path: ['integrations', 'risk_integration', 'enabled'], parse: parseEnvValue},
	VOXR_RISK_IPINFO_API_KEY: {path: ['integrations', 'risk_integration', 'ipinfo_api_key']},
	VOXR_ACCOUNT_POLICY_DSL: {
		path: ['integrations', 'risk_integration', 'account_policy_dsl'],
		parse: parseEnvValue,
	},
	VOXR_RISK_TOR_BLOCK_ALL_RELAYS: {
		path: ['integrations', 'risk_integration', 'tor', 'block_all_relays'],
		parse: parseEnvValue,
	},
	VOXR_RISK_TOR_REVERSE_DNS_HEURISTIC: {
		path: ['integrations', 'risk_integration', 'tor', 'reverse_dns_heuristic'],
		parse: parseEnvValue,
	},
	VOXR_RISK_TOR_REVERSE_DNS_TIMEOUT_MS: {
		path: ['integrations', 'risk_integration', 'tor', 'reverse_dns_timeout_ms'],
		parse: parseInteger,
	},
	VOXR_PUSH_APNS_ENABLED: {path: ['integrations', 'push', 'apns', 'enabled'], parse: parseEnvValue},
	VOXR_PUSH_APNS_TEAM_ID: {path: ['integrations', 'push', 'apns', 'team_id']},
	VOXR_PUSH_APNS_KEY_ID: {path: ['integrations', 'push', 'apns', 'key_id']},
	VOXR_PUSH_APNS_PRIVATE_KEY: {path: ['integrations', 'push', 'apns', 'private_key']},
	VOXR_PUSH_APNS_PRIVATE_KEY_PATH: {path: ['integrations', 'push', 'apns', 'private_key_path']},
	VOXR_PUSH_APNS_DEFAULT_ENVIRONMENT: {path: ['integrations', 'push', 'apns', 'default_environment']},
	VOXR_PUSH_APNS_APPS: {path: ['integrations', 'push', 'apns', 'apps'], parse: parseEnvValue},
	VOXR_PUSH_FCM_ENABLED: {path: ['integrations', 'push', 'fcm', 'enabled'], parse: parseEnvValue},
	VOXR_PUSH_FCM_PROJECT_ID: {path: ['integrations', 'push', 'fcm', 'project_id']},
	VOXR_PUSH_FCM_CLIENT_EMAIL: {path: ['integrations', 'push', 'fcm', 'client_email']},
	VOXR_PUSH_FCM_PRIVATE_KEY: {path: ['integrations', 'push', 'fcm', 'private_key']},
	VOXR_PUSH_FCM_PRIVATE_KEY_PATH: {path: ['integrations', 'push', 'fcm', 'private_key_path']},
	VOXR_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH: {path: ['integrations', 'push', 'fcm', 'service_account_json_path']},
	VOXR_PUSH_FCM_TOKEN_URI: {path: ['integrations', 'push', 'fcm', 'token_uri']},
	VOXR_PUSH_FCM_APPS: {path: ['integrations', 'push', 'fcm', 'apps'], parse: parseEnvValue},
	VOXR_SELF_HOSTED: {path: ['instance', 'self_hosted'], parse: parseEnvValue},
	VOXR_AUTO_JOIN_INVITE_CODE: {path: ['instance', 'auto_join_invite_code']},
	VOXR_VISIONARIES_GUILD_ID: {path: ['instance', 'visionaries_guild_id']},
	VOXR_VISIONARIES_GUILD_VISIONARY_ROLE_ID: {path: ['instance', 'visionaries_guild_visionary_role_id']},
	VOXR_APP_PRODUCT_NAME: {path: ['instance', 'branding', 'product_name']},
	VOXR_APP_ICON_URL: {path: ['instance', 'branding', 'icon_url']},
	VOXR_APP_SYMBOL_URL: {path: ['instance', 'branding', 'symbol_url']},
	VOXR_APP_LOGO_URL: {path: ['instance', 'branding', 'logo_url']},
	VOXR_APP_WORDMARK_URL: {path: ['instance', 'branding', 'wordmark_url']},
	VOXR_APP_FAVICON_URL: {path: ['instance', 'branding', 'favicon_url']},
	VOXR_APP_THEME_COLOR: {path: ['instance', 'branding', 'theme_color']},
	VOXR_INSTANCE_SETUP_CONFIGURED: {path: ['instance', 'setup', 'configured'], parse: parseEnvValue},
	VOXR_ABUSE_INBOUND_PHONE_COUNTRY_CODES: {
		path: ['instance', 'abuse_policy', 'inbound_phone_country_codes'],
		parse: parseCsv,
	},
	VOXR_ABUSE_PHONE_INBOUND_REQUIRED_PREFIXES: {
		path: ['instance', 'abuse_policy', 'phone_verification', 'inbound_required_prefixes'],
		parse: parseCsv,
	},
	VOXR_ABUSE_DIRECT_CONTACT_SPAM_ENABLED: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'enabled'],
		parse: parseEnvValue,
	},
	VOXR_ABUSE_DIRECT_CONTACT_SPAM_COUNTRY_CODES: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'country_codes'],
		parse: parseCsv,
	},
	VOXR_ABUSE_DIRECT_CONTACT_SPAM_DISTINCT_TARGET_THRESHOLD: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'distinct_target_threshold'],
		parse: parseInteger,
	},
	VOXR_ABUSE_DIRECT_CONTACT_SPAM_TARGET_WINDOW_MS: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'target_window_ms'],
		parse: parseInteger,
	},
	VOXR_ABUSE_DIRECT_CONTACT_SPAM_ACTION: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'action'],
	},
	VOXR_DISCOVERY_ENABLED: {path: ['discovery', 'enabled'], parse: parseEnvValue},
	VOXR_DISCOVERY_MIN_MEMBER_COUNT: {path: ['discovery', 'min_member_count'], parse: parseInteger},
	VOXR_DELETION_GRACE_PERIOD_HOURS: {path: ['deletion_grace_period_hours'], parse: parseInteger},
	VOXR_RELAX_REGISTRATION_RATE_LIMITS: {path: ['dev', 'relax_registration_rate_limits'], parse: parseEnvValue},
	VOXR_DISABLE_RATE_LIMITS: {path: ['dev', 'disable_rate_limits'], parse: parseEnvValue},
	VOXR_TEST_MODE_ENABLED: {path: ['dev', 'test_mode_enabled'], parse: parseEnvValue},
	VOXR_TEST_HARNESS_TOKEN: {path: ['dev', 'test_harness_token']},
	VOXR_VALIDATE_RESPONSES: {path: ['dev', 'validate_responses'], parse: parseEnvValue},
	VOXR_GEOIP_DB_PATH: {path: ['geoip', 'maxmind_db_path']},
};

function isPlainObject(value: unknown): value is ConfigObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isContainer(value: unknown): value is ConfigContainer {
	return isPlainObject(value) || Array.isArray(value);
}

function createChildContainer(nextKey: ConfigPathKey | undefined): ConfigContainer {
	return typeof nextKey === 'number' ? [] : {};
}

function getChildValue(target: ConfigContainer, key: ConfigPathKey): unknown {
	return target[key as keyof typeof target];
}

function setChildValue(target: ConfigContainer, key: ConfigPathKey, value: unknown): void {
	if (Array.isArray(target) && typeof key === 'number') {
		target[key] = value;
		return;
	}
	(target as ConfigObject)[String(key)] = value;
}

function toChildContainer(value: unknown, nextKey: ConfigPathKey | undefined): ConfigContainer {
	if (isContainer(value)) {
		return value;
	}
	return createChildContainer(nextKey);
}

export function parseEnvValue(raw: string): unknown {
	const trimmed = raw.trim();
	const lower = trimmed.toLowerCase();
	if (lower === 'true') {
		return true;
	}
	if (lower === 'false') {
		return false;
	}
	if (/^-?\d+$/.test(trimmed)) {
		return Number.parseInt(trimmed, 10);
	}
	if (/^-?\d+\.\d+$/.test(trimmed)) {
		return Number.parseFloat(trimmed);
	}
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			return JSON.parse(trimmed);
		} catch (error) {
			throw new Error(`must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return raw;
}

function parseInteger(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	if (!/^-?\d+$/.test(trimmed)) {
		throw new Error(`must be an integer, got ${JSON.stringify(raw)}`);
	}
	return Number.parseInt(trimmed, 10);
}

function parseCsv(raw: string): Array<string> {
	return raw
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

export function setNestedValue(target: ConfigContainer, keys: Array<ConfigPathKey>, value: unknown): void {
	if (keys.length === 0) {
		return;
	}
	const [first, ...rest] = keys;
	if (rest.length === 0) {
		setChildValue(target, first, value);
		return;
	}
	const child = getChildValue(target, first);
	if (!isContainer(child)) {
		setChildValue(target, first, createChildContainer(rest[0]));
	}
	setNestedValue(toChildContainer(getChildValue(target, first), rest[0]), rest, value);
}

const NAMED_VOXR_ENV_ALIASES: Record<string, string | undefined> = {
	VOXR_INTERNAL_MEDIA_PROXY_ENDPOINT: 'VOXR_MEDIA_PROXY_ENDPOINT',
	VOXR_NATS_URL: 'VOXR_NATS_CORE_URL',
};

export function buildNamedVoxrEnvOverrides(env: NodeJS.ProcessEnv): ConfigObject {
	const overrides: ConfigObject = {};
	for (const [envKey, mapping] of Object.entries(NAMED_VOXR_ENV_OVERRIDES)) {
		const alias = NAMED_VOXR_ENV_ALIASES[envKey];
		const raw = env[envKey] ?? (alias === undefined ? undefined : env[alias]);
		if (raw === undefined) {
			continue;
		}
		let parsed: unknown;
		try {
			parsed = (mapping.parse ?? ((value: string) => value))(raw);
		} catch (error) {
			throw new Error(`${envKey} ${error instanceof Error ? error.message : String(error)}`);
		}
		if (parsed === undefined) {
			continue;
		}
		setNestedValue(overrides, mapping.path, parsed);
	}
	return overrides;
}
