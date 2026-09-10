// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	buildUrl,
	canonicalizeDomain,
	type DomainConfig,
	deriveDomain,
	deriveEndpointsFromDomain,
	normalizePublicEndpoint,
	parsePublicOrigin,
} from '@voxr/config/src/EndpointDerivation';
import {describe, expect, test} from 'vitest';

describe('buildUrl', () => {
	test('omits standard HTTP port (80)', () => {
		expect(buildUrl('http', 'example.com', 80, '/path')).toBe('http://example.com/path');
	});
	test('omits standard HTTPS port (443)', () => {
		expect(buildUrl('https', 'example.com', 443, '/path')).toBe('https://example.com/path');
	});
	test('omits standard WebSocket port (80)', () => {
		expect(buildUrl('ws', 'example.com', 80, '/gateway')).toBe('ws://example.com/gateway');
	});
	test('omits standard secure WebSocket port (443)', () => {
		expect(buildUrl('wss', 'example.com', 443, '/gateway')).toBe('wss://example.com/gateway');
	});
	test('includes non-standard port', () => {
		expect(buildUrl('http', 'localhost', 8088, '/api')).toBe('http://localhost:8088/api');
	});
	test('includes non-standard HTTPS port', () => {
		expect(buildUrl('https', 'example.com', 8443, '/api')).toBe('https://example.com:8443/api');
	});
	test('handles missing port', () => {
		expect(buildUrl('https', 'example.com', undefined, '/api')).toBe('https://example.com/api');
	});
	test('handles missing path', () => {
		expect(buildUrl('https', 'example.com', 443)).toBe('https://example.com');
	});
	test('handles empty path', () => {
		expect(buildUrl('https', 'example.com', 443, '')).toBe('https://example.com');
	});
	test('handles root path', () => {
		expect(buildUrl('https', 'example.com', 443, '/')).toBe('https://example.com/');
	});
});

describe('deriveDomain', () => {
	const baseConfig: DomainConfig = {
		base_domain: 'voxr.dev',
		public_scheme: 'https',
		internal_scheme: 'http',
	};
	test('uses base domain for api endpoint', () => {
		expect(deriveDomain('api', baseConfig)).toBe('voxr.dev');
	});
	test('uses base domain for app endpoint', () => {
		expect(deriveDomain('app', baseConfig)).toBe('voxr.dev');
	});
	test('uses base domain for gateway endpoint', () => {
		expect(deriveDomain('gateway', baseConfig)).toBe('voxr.dev');
	});
	test('uses base domain for media endpoint', () => {
		expect(deriveDomain('media', baseConfig)).toBe('voxr.dev');
	});
	test('uses custom static CDN domain when specified', () => {
		const config = {...baseConfig, static_cdn_domain: 'cdn.voxr.dev'};
		expect(deriveDomain('static_cdn', config)).toBe('cdn.voxr.dev');
	});
	test('uses base domain for static CDN when custom domain not specified', () => {
		expect(deriveDomain('static_cdn', baseConfig)).toBe('voxr.dev');
	});
	test('uses custom invite domain when specified', () => {
		const config = {...baseConfig, invite_domain: 'voxr.gg'};
		expect(deriveDomain('invite', config)).toBe('voxr.gg');
	});
	test('uses base domain for invite when custom domain not specified', () => {
		expect(deriveDomain('invite', baseConfig)).toBe('voxr.dev');
	});
	test('uses custom gift domain when specified', () => {
		const config = {...baseConfig, gift_domain: 'voxr.gift'};
		expect(deriveDomain('gift', config)).toBe('voxr.gift');
	});
	test('uses base domain for gift when custom domain not specified', () => {
		expect(deriveDomain('gift', baseConfig)).toBe('voxr.dev');
	});
});

describe('deriveEndpointsFromDomain', () => {
	describe('development environment (localhost)', () => {
		const devConfig: DomainConfig = {
			base_domain: 'localhost',
			public_scheme: 'http',
			internal_scheme: 'http',
			public_port: 8088,
			internal_port: 8088,
		};
		const endpoints = deriveEndpointsFromDomain(devConfig);
		test('derives api endpoint with port', () => {
			expect(endpoints.api).toBe('http://localhost:8088/api');
		});
		test('derives api client endpoint with port', () => {
			expect(endpoints.api_client).toBe('http://localhost:8088/api');
		});
		test('derives app endpoint with port', () => {
			expect(endpoints.app).toBe('http://localhost:8088');
		});
		test('derives gateway endpoint with ws scheme', () => {
			expect(endpoints.gateway).toBe('ws://localhost:8088/gateway');
		});
		test('derives media endpoint with port', () => {
			expect(endpoints.media).toBe('http://localhost:8088/media');
		});
		test('derives static CDN endpoint via public origin', () => {
			expect(endpoints.static_cdn).toBe('http://localhost:8088');
		});
		test('derives admin endpoint with port', () => {
			expect(endpoints.admin).toBe('http://localhost:8088/admin');
		});
		test('derives marketing endpoint with port', () => {
			expect(endpoints.marketing).toBe('http://localhost:8088/marketing');
		});
		test('derives invite endpoint with port', () => {
			expect(endpoints.invite).toBe('http://localhost:8088/invite');
		});
		test('derives gift endpoint with port', () => {
			expect(endpoints.gift).toBe('http://localhost:8088/gift');
		});
	});
	describe('production environment (standard HTTPS port)', () => {
		const prodConfig: DomainConfig = {
			base_domain: 'voxr.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			internal_port: 8080,
		};
		const endpoints = deriveEndpointsFromDomain(prodConfig);
		test('derives api endpoint without port', () => {
			expect(endpoints.api).toBe('https://voxr.app/api');
		});
		test('derives api client endpoint without port', () => {
			expect(endpoints.api_client).toBe('https://voxr.app/api');
		});
		test('derives app endpoint without port', () => {
			expect(endpoints.app).toBe('https://voxr.app');
		});
		test('derives gateway endpoint with wss scheme without port', () => {
			expect(endpoints.gateway).toBe('wss://voxr.app/gateway');
		});
		test('derives media endpoint without port', () => {
			expect(endpoints.media).toBe('https://voxr.app/media');
		});
		test('derives static CDN endpoint without port', () => {
			expect(endpoints.static_cdn).toBe('https://voxr.app');
		});
		test('derives admin endpoint without port', () => {
			expect(endpoints.admin).toBe('https://voxr.app/admin');
		});
		test('derives marketing endpoint without port', () => {
			expect(endpoints.marketing).toBe('https://voxr.app/marketing');
		});
		test('derives invite endpoint without port', () => {
			expect(endpoints.invite).toBe('https://voxr.app/invite');
		});
		test('derives gift endpoint without port', () => {
			expect(endpoints.gift).toBe('https://voxr.app/gift');
		});
	});
	describe('staging environment (custom port)', () => {
		const stagingConfig: DomainConfig = {
			base_domain: 'staging.voxr.dev',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 8443,
			internal_port: 8080,
		};
		const endpoints = deriveEndpointsFromDomain(stagingConfig);
		test('derives api endpoint with custom port', () => {
			expect(endpoints.api).toBe('https://staging.voxr.dev:8443/api');
		});
		test('derives api client endpoint with custom port', () => {
			expect(endpoints.api_client).toBe('https://staging.voxr.dev:8443/api');
		});
		test('derives app endpoint with custom port', () => {
			expect(endpoints.app).toBe('https://staging.voxr.dev:8443');
		});
		test('derives gateway endpoint with wss and custom port', () => {
			expect(endpoints.gateway).toBe('wss://staging.voxr.dev:8443/gateway');
		});
	});
	describe('custom CDN domain', () => {
		const staticCdnConfig: DomainConfig = {
			base_domain: 'voxr.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			static_cdn_domain: 'cdn.voxr.app',
		};
		const endpoints = deriveEndpointsFromDomain(staticCdnConfig);
		test('uses custom CDN domain', () => {
			expect(endpoints.static_cdn).toBe('https://cdn.voxr.app');
		});
		test('other endpoints use base domain', () => {
			expect(endpoints.api).toBe('https://voxr.app/api');
			expect(endpoints.app).toBe('https://voxr.app');
		});
	});
	describe('custom invite and gift domains', () => {
		const customConfig: DomainConfig = {
			base_domain: 'voxr.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			invite_domain: 'voxr.gg',
			gift_domain: 'voxr.gift',
		};
		const endpoints = deriveEndpointsFromDomain(customConfig);
		test('uses custom invite domain', () => {
			expect(endpoints.invite).toBe('https://voxr.gg/invite');
		});
		test('uses custom gift domain', () => {
			expect(endpoints.gift).toBe('https://voxr.gift/gift');
		});
		test('other endpoints use base domain', () => {
			expect(endpoints.api).toBe('https://voxr.app/api');
			expect(endpoints.app).toBe('https://voxr.app');
		});
	});
	describe('WebSocket scheme derivation', () => {
		test('derives ws from http', () => {
			const config: DomainConfig = {
				base_domain: 'localhost',
				public_scheme: 'http',
				internal_scheme: 'http',
				public_port: 8088,
			};
			const endpoints = deriveEndpointsFromDomain(config);
			expect(endpoints.gateway).toBe('ws://localhost:8088/gateway');
		});
		test('derives wss from https', () => {
			const config: DomainConfig = {
				base_domain: 'voxr.app',
				public_scheme: 'https',
				internal_scheme: 'http',
				public_port: 443,
			};
			const endpoints = deriveEndpointsFromDomain(config);
			expect(endpoints.gateway).toBe('wss://voxr.app/gateway');
		});
	});
	describe('canary environment', () => {
		const canaryConfig: DomainConfig = {
			base_domain: 'canary.voxr.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			static_cdn_domain: 'cdn-canary.voxr.app',
		};
		const endpoints = deriveEndpointsFromDomain(canaryConfig);
		test('derives api endpoint for canary', () => {
			expect(endpoints.api).toBe('https://canary.voxr.app/api');
		});
		test('derives app endpoint for canary', () => {
			expect(endpoints.app).toBe('https://canary.voxr.app');
		});
		test('derives gateway endpoint for canary', () => {
			expect(endpoints.gateway).toBe('wss://canary.voxr.app/gateway');
		});
		test('uses custom CDN domain for canary', () => {
			expect(endpoints.static_cdn).toBe('https://cdn-canary.voxr.app');
		});
	});
	describe('edge cases', () => {
		test('handles standard HTTP port (80)', () => {
			const config: DomainConfig = {
				base_domain: 'example.com',
				public_scheme: 'http',
				internal_scheme: 'http',
				public_port: 80,
			};
			const endpoints = deriveEndpointsFromDomain(config);
			expect(endpoints.api).toBe('http://example.com/api');
			expect(endpoints.gateway).toBe('ws://example.com/gateway');
		});
		test('handles ports when undefined', () => {
			const config: DomainConfig = {
				base_domain: 'example.com',
				public_scheme: 'https',
				internal_scheme: 'http',
			};
			const endpoints = deriveEndpointsFromDomain(config);
			expect(endpoints.api).toBe('https://example.com/api');
			expect(endpoints.app).toBe('https://example.com');
		});
		test('handles IPv4 addresses', () => {
			const config: DomainConfig = {
				base_domain: '127.0.0.1',
				public_scheme: 'http',
				internal_scheme: 'http',
				public_port: 8088,
			};
			const endpoints = deriveEndpointsFromDomain(config);
			expect(endpoints.api).toBe('http://127.0.0.1:8088/api');
		});
	});
});

describe('normalizePublicEndpoint', () => {
	test('leaves a default https install untouched', () => {
		expect(normalizePublicEndpoint('https://voxr.dev', 'voxr.dev', 443)).toBe('https://voxr.dev');
		expect(normalizePublicEndpoint('https://voxr.dev/media', 'voxr.dev', 443)).toBe('https://voxr.dev/media');
		expect(normalizePublicEndpoint('wss://voxr.dev/gateway', 'voxr.dev', 443)).toBe('wss://voxr.dev/gateway');
	});
	test('leaves a default http install untouched', () => {
		expect(normalizePublicEndpoint('http://voxr.dev', 'voxr.dev', 80)).toBe('http://voxr.dev');
		expect(normalizePublicEndpoint('http://voxr.dev/media', 'voxr.dev', 80)).toBe('http://voxr.dev/media');
		expect(normalizePublicEndpoint('ws://voxr.dev/gateway', 'voxr.dev', 80)).toBe('ws://voxr.dev/gateway');
	});
	test('inserts a non-standard port', () => {
		expect(normalizePublicEndpoint('https://voxr.dev', 'voxr.dev', 8443)).toBe('https://voxr.dev:8443');
		expect(normalizePublicEndpoint('https://voxr.dev/media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:8443/media',
		);
		expect(normalizePublicEndpoint('wss://voxr.dev/gateway', 'voxr.dev', 8443)).toBe(
			'wss://voxr.dev:8443/gateway',
		);
	});
	test('judges standard ports against the url scheme, not the public scheme', () => {
		expect(normalizePublicEndpoint('http://voxr.dev/media', 'voxr.dev', 443)).toBe('http://voxr.dev:443/media');
		expect(normalizePublicEndpoint('https://voxr.dev/media', 'voxr.dev', 80)).toBe('https://voxr.dev:80/media');
	});
	test('leaves a foreign host untouched', () => {
		expect(normalizePublicEndpoint('https://cdn.example.net/media', 'voxr.dev', 8443)).toBe(
			'https://cdn.example.net/media',
		);
		expect(normalizePublicEndpoint('https://sub.voxr.dev', 'voxr.dev', 8443)).toBe('https://sub.voxr.dev');
	});
	test('leaves an already ported url untouched', () => {
		expect(normalizePublicEndpoint('https://voxr.dev:8443/media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:8443/media',
		);
		expect(normalizePublicEndpoint('https://voxr.dev:9000/media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:9000/media',
		);
		expect(normalizePublicEndpoint('https://voxr.dev:443/media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:443/media',
		);
	});
	test('is idempotent', () => {
		const once = normalizePublicEndpoint('https://voxr.dev/media', 'voxr.dev', 8443);
		expect(normalizePublicEndpoint(once, 'voxr.dev', 8443)).toBe(once);
	});
	test('preserves path, query, fragment, trailing slash, and case', () => {
		expect(normalizePublicEndpoint('https://voxr.dev/Media/', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:8443/Media/',
		);
		expect(normalizePublicEndpoint('https://voxr.dev/media?a=B#Frag', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:8443/media?a=B#Frag',
		);
		expect(normalizePublicEndpoint('https://voxr.dev?a=B', 'voxr.dev', 8443)).toBe('https://voxr.dev:8443?a=B');
		expect(normalizePublicEndpoint('https://voxr.dev#Frag', 'voxr.dev', 8443)).toBe('https://voxr.dev:8443#Frag');
		expect(normalizePublicEndpoint('https://user:pw@voxr.dev/media', 'voxr.dev', 8443)).toBe(
			'https://user:pw@voxr.dev:8443/media',
		);
	});
	test('matches the host case-insensitively and ignores a trailing dot', () => {
		expect(normalizePublicEndpoint('https://VOXR.dev/media', 'voxr.dev', 8443)).toBe(
			'https://VOXR.dev:8443/media',
		);
		expect(normalizePublicEndpoint('https://voxr.dev./media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev.:8443/media',
		);
		expect(normalizePublicEndpoint('https://voxr.dev/media', 'VOXR.dev.', 8443)).toBe(
			'https://voxr.dev:8443/media',
		);
	});
	test('leaves unparseable and non-http values untouched', () => {
		expect(normalizePublicEndpoint('not a url', 'voxr.dev', 8443)).toBe('not a url');
		expect(normalizePublicEndpoint('', 'voxr.dev', 8443)).toBe('');
		expect(normalizePublicEndpoint('android:apk-key-hash:abc', 'voxr.dev', 8443)).toBe('android:apk-key-hash:abc');
		expect(normalizePublicEndpoint('https://voxr.dev:/media', 'voxr.dev', 8443)).toBe('https://voxr.dev:/media');
	});
	test('leaves malformed authorities untouched', () => {
		expect(normalizePublicEndpoint('https:voxr.dev/media', 'voxr.dev', 8443)).toBe('https:voxr.dev/media');
		expect(normalizePublicEndpoint('https:/voxr.dev/media', 'voxr.dev', 8443)).toBe('https:/voxr.dev/media');
		expect(normalizePublicEndpoint('https:////voxr.dev/media', 'voxr.dev', 8443)).toBe(
			'https:////voxr.dev/media',
		);
		expect(normalizePublicEndpoint('https://voxr.dev\\media', 'voxr.dev', 8443)).toBe(
			'https://voxr.dev:8443\\media',
		);
	});
	test('leaves everything untouched without a usable port or base domain', () => {
		expect(normalizePublicEndpoint('https://voxr.dev/media', 'voxr.dev')).toBe('https://voxr.dev/media');
		expect(normalizePublicEndpoint('https://voxr.dev/media', '', 8443)).toBe('https://voxr.dev/media');
		expect(normalizePublicEndpoint('https://voxr.dev/media', '   ', 8443)).toBe('https://voxr.dev/media');
	});
});

describe('canonicalizeDomain', () => {
	test('lowercases, trims and drops the root dot', () => {
		expect(canonicalizeDomain('  CHAT.Example.COM.  ')).toBe('chat.example.com');
	});
	test('leaves an empty value empty', () => {
		expect(canonicalizeDomain('   ')).toBe('');
	});
});

describe('parsePublicOrigin', () => {
	test('reads scheme, host and a non-standard port', () => {
		expect(parsePublicOrigin('https://chat.example.com:8443')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 8443,
		});
		expect(parsePublicOrigin('http://chat.example.com:19080')).toEqual({
			public_scheme: 'http',
			base_domain: 'chat.example.com',
			public_port: 19080,
		});
	});
	test('fills in the standard port for a portless origin', () => {
		expect(parsePublicOrigin('https://chat.example.com')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 443,
		});
		expect(parsePublicOrigin('http://chat.example.com')).toEqual({
			public_scheme: 'http',
			base_domain: 'chat.example.com',
			public_port: 80,
		});
	});
	test('normalizes an explicitly written standard port to the portless form', () => {
		const origin = parsePublicOrigin('https://chat.example.com:443');
		expect(origin).toEqual({public_scheme: 'https', base_domain: 'chat.example.com', public_port: 443});
		expect(buildUrl(origin?.public_scheme ?? 'https', origin?.base_domain ?? '', origin?.public_port)).toBe(
			'https://chat.example.com',
		);
		expect(parsePublicOrigin('http://chat.example.com:80')?.public_port).toBe(80);
	});
	test('canonicalizes the host', () => {
		expect(parsePublicOrigin('  https://CHAT.Example.com.:8443  ')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 8443,
		});
	});
	test('keeps an IPv6 literal bracketed', () => {
		expect(parsePublicOrigin('http://[::1]:19080')).toEqual({
			public_scheme: 'http',
			base_domain: '[::1]',
			public_port: 19080,
		});
	});
	test('accepts a bare trailing slash', () => {
		expect(parsePublicOrigin('https://chat.example.com:8443/')?.public_port).toBe(8443);
	});
	test('rejects anything that is not a bare origin', () => {
		expect(parsePublicOrigin('')).toBeNull();
		expect(parsePublicOrigin('   ')).toBeNull();
		expect(parsePublicOrigin('not a url')).toBeNull();
		expect(parsePublicOrigin('chat.example.com:8443')).toBeNull();
		expect(parsePublicOrigin('wss://chat.example.com')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com/media')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com?a=1')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com#top')).toBeNull();
		expect(parsePublicOrigin('https://user:pw@chat.example.com')).toBeNull();
	});
});

describe('endpoints derived from a public origin', () => {
	test('an origin with a non-standard port ports every derived endpoint', () => {
		const origin = parsePublicOrigin('https://chat.example.com:29080');
		const endpoints = deriveEndpointsFromDomain({
			base_domain: origin?.base_domain ?? '',
			public_scheme: origin?.public_scheme ?? 'https',
			internal_scheme: 'http',
			public_port: origin?.public_port,
		});
		expect(endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(endpoints.app).toBe('https://chat.example.com:29080');
		expect(endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(endpoints.admin).toBe('https://chat.example.com:29080/admin');
	});
	test('an origin written with an explicit :443 derives portless endpoints', () => {
		const origin = parsePublicOrigin('https://chat.example.com:443');
		const endpoints = deriveEndpointsFromDomain({
			base_domain: origin?.base_domain ?? '',
			public_scheme: origin?.public_scheme ?? 'https',
			internal_scheme: 'http',
			public_port: origin?.public_port,
		});
		expect(endpoints.admin).toBe('https://chat.example.com/admin');
		expect(endpoints.app).toBe('https://chat.example.com');
		expect(endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});
});
