// SPDX-License-Identifier: AGPL-3.0-or-later

import {existsSync} from 'node:fs';
import {loadConfig} from '@voxr/config/src/ConfigLoader';
import type {UserPartialResponse} from '@voxr/schema/src/domains/user/UserResponseSchemas';
import {afterAll, afterEach, beforeAll} from 'vitest';
import type {UserID} from '../BrandedTypes';
import {buildAPIConfigFromMaster, initializeConfig} from '../Config';
import {setInjectedMessageResponseDataService} from '../channel/services/message/MessageResponseDataService';
import {
	resetCassandraQueryExecutorForTesting,
	setCassandraQueryExecutorForTesting,
	shutdownCassandraQueryExecutorForTesting,
} from '../database/CassandraQueryExecution';
import type {IUsersServiceClient} from '../infrastructure/UsersServiceClient';
import {setInjectedUsersServiceClient} from '../infrastructure/UsersServiceClient';
import {initializeLogger} from '../Logger';
import {setInjectedKVProvider, setInjectedSnowflakeService} from '../middleware/ServiceRegistry';
import {getInstanceConfigRepository, getUserRepository} from '../middleware/ServiceSingletons';
import {drainSearchTasks, enableSearchTaskTracking} from '../search/SearchTaskTracker';
import {mapUserToPartialResponse} from '../user/UserMappers';
import {InMemoryCassandraQueryExecutor} from './InMemoryCassandraQueryExecutor';
import {MockKVProvider} from './mocks/MockKVProvider';
import {MockSnowflakeService} from './mocks/MockSnowflakeService';
import {NoopLogger} from './mocks/NoopLogger';
import {RepositoryBackedMessageResponseDataService} from './mocks/RepositoryBackedMessageResponseDataService';
import {fakeNcmecServer} from './msw/handlers/NcmecHandlers';
import {server} from './msw/server';

function defaultNatsUrl(): string {
	return `nats://${existsSync('/.dockerenv') ? 'nats' : '127.0.0.1'}:4222`;
}

function setDefaultTestEnv(): void {
	// API tests use a non-self-hosted baseline; self-hosted scenarios override the loaded config explicitly.
	process.env.VOXR_SELF_HOSTED = 'false';

	const natsUrl = defaultNatsUrl();
	const defaults: Record<string, string> = {
		VOXR_ENV: 'test',
		VOXR_BASE_DOMAIN: 'localhost',
		VOXR_PUBLIC_SCHEME: 'http',
		VOXR_PUBLIC_PORT: '8088',
		VOXR_TRUST_CLIENT_IP_HEADER: 'true',
		VOXR_CLIENT_IP_HEADER_NAME: 'x-forwarded-for',
		VOXR_CASSANDRA_HOSTS: '127.0.0.1',
		VOXR_CASSANDRA_PORT: '9042',
		VOXR_CASSANDRA_KEYSPACE: 'voxr_test',
		VOXR_CASSANDRA_LOCAL_DC: 'datacenter1',
		VOXR_CASSANDRA_USERNAME: 'cassandra',
		VOXR_CASSANDRA_PASSWORD: 'cassandra',
		VOXR_KV_URL: 'redis://127.0.0.1:6379/0',
		VOXR_NATS_URL: natsUrl,
		VOXR_NATS_CORE_URL: natsUrl,
		VOXR_NATS_JETSTREAM_URL: natsUrl,
		VOXR_INTERNAL_API_ENDPOINT: 'http://127.0.0.1:8088/api',
		VOXR_INTERNAL_GATEWAY_ENDPOINT: 'http://127.0.0.1:8088/gateway',
		VOXR_INTERNAL_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
		VOXR_S3_ENDPOINT: 'http://127.0.0.1:3900',
		VOXR_S3_REGION: 'local',
		VOXR_S3_ACCESS_KEY_ID: 'test',
		VOXR_S3_SECRET_ACCESS_KEY: 'test',
		VOXR_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: 'false',
		VOXR_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
		VOXR_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
		VOXR_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
		VOXR_MARKETING_SECRET_KEY_BASE: 'test-marketing-secret',
		VOXR_APP_PROXY_PORT: '8773',
		VOXR_GATEWAY_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
		VOXR_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-rpc-token',
		VOXR_SUDO_MODE_SECRET: 'test-sudo-secret',
		VOXR_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
		VOXR_VAPID_PUBLIC_KEY: 'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
		VOXR_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
		VOXR_VAPID_EMAIL: 'test@example.com',
		VOXR_PASSKEY_RP_NAME: 'Voxr Test',
		VOXR_PASSKEY_RP_ID: 'localhost',
		VOXR_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'http://localhost',
		VOXR_EMAIL_ENABLED: 'true',
		VOXR_EMAIL_PROVIDER: 'smtp',
		VOXR_EMAIL_FROM_EMAIL: 'noreply@example.com',
		VOXR_EMAIL_SMTP_HOST: 'localhost',
		VOXR_EMAIL_SMTP_PORT: '1025',
		VOXR_EMAIL_SMTP_USERNAME: 'test',
		VOXR_EMAIL_SMTP_PASSWORD: 'test',
		VOXR_EMAIL_SMTP_SECURE: 'false',
		VOXR_LIVEKIT_ENABLED: 'false',
		VOXR_STRIPE_ENABLED: 'true',
		VOXR_SEARCH_ENGINE: 'elasticsearch',
		VOXR_SEARCH_URL: 'http://127.0.0.1:9200',
		VOXR_SEARCH_API_KEY: 'test',
		VOXR_CAPTCHA_ENABLED: 'false',
		VOXR_CAPTCHA_PROVIDER: 'none',
		VOXR_DISCOVERY_ENABLED: 'true',
		VOXR_RELAX_REGISTRATION_RATE_LIMITS: 'true',
		VOXR_DISABLE_RATE_LIMITS: 'true',
		VOXR_TEST_MODE_ENABLED: 'true',
	};
	for (const [key, value] of Object.entries(defaults)) {
		process.env[key] ??= value;
	}
}

class RepositoryBackedUsersServiceClient implements IUsersServiceClient {
	async getUserPartialResponses(userIds: Array<UserID>): Promise<Map<UserID, UserPartialResponse>> {
		const userRepository = getUserRepository();
		const result = new Map<UserID, UserPartialResponse>();
		for (const userId of userIds) {
			const user = await userRepository.findUnique(userId);
			if (user) {
				result.set(userId, mapUserToPartialResponse(user));
			}
		}
		return result;
	}

	async invalidateUserCache(_userId: UserID): Promise<void> {}
}

setDefaultTestEnv();
process.env.VOXR_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 ??= 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

const master = await loadConfig();
const apiConfig = buildAPIConfigFromMaster(master);
const testApiConfig = {
	...apiConfig,
	auth: {
		...apiConfig.auth,
		passkeys: {
			...apiConfig.auth.passkeys,
			rpId: 'localhost',
			allowedOrigins: ['http://localhost'],
		},
	},
	voice: {
		...apiConfig.voice,
		enabled: false,
	},
	stripe: {
		...apiConfig.stripe,
		enabled: true,
		secretKey: 'sk_test_voxr',
		webhookSecret: 'whsec_test_voxr',
	},
	ncmec: {
		...apiConfig.ncmec,
		enabled: true,
		baseUrl: fakeNcmecServer.baseUrl,
		username: 'usr123',
		password: 'pswd123',
	},
};
testApiConfig.dev.relaxRegistrationRateLimits = true;
testApiConfig.dev.disableRateLimits = true;
testApiConfig.dev.testModeEnabled = true;

initializeConfig(testApiConfig);

const bootstrapLogger = new NoopLogger();

initializeLogger(bootstrapLogger);

setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());

setInjectedKVProvider(new MockKVProvider());
setInjectedSnowflakeService(new MockSnowflakeService({startTimestampMs: Date.now()}));
setInjectedUsersServiceClient(new RepositoryBackedUsersServiceClient());
setInjectedMessageResponseDataService(new RepositoryBackedMessageResponseDataService());

enableSearchTaskTracking();

export {fakeNcmecServer};

beforeAll(async () => {
	server.listen({
		onUnhandledRequest: 'error',
	});
});

afterEach(async () => {
	await drainSearchTasks();
	resetCassandraQueryExecutorForTesting();
	getInstanceConfigRepository().clearCacheForTesting();
	server.resetHandlers();
	fakeNcmecServer.reset();
});

afterAll(async () => {
	server.close();
	await shutdownCassandraQueryExecutorForTesting();
});
