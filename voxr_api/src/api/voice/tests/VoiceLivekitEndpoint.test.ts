// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {resolveLivekitEndpoint} from '../VoiceDataInitializer';

describe('resolveLivekitEndpoint', () => {
	it('keeps the public port when the instance does not serve on the default port', () => {
		expect(resolveLivekitEndpoint(undefined, 'http://inplace.localhost:19480/api')).toBe(
			'ws://inplace.localhost:19480/livekit',
		);
		expect(resolveLivekitEndpoint('', 'https://voxr.example.com:8443/api')).toBe(
			'wss://voxr.example.com:8443/livekit',
		);
	});

	it('omits the port when the public endpoint uses the default port for its scheme', () => {
		expect(resolveLivekitEndpoint(undefined, 'https://voxr.example.com/api')).toBe(
			'wss://voxr.example.com/livekit',
		);
		expect(resolveLivekitEndpoint(undefined, 'https://voxr.example.com:443/api')).toBe(
			'wss://voxr.example.com/livekit',
		);
		expect(resolveLivekitEndpoint(undefined, 'http://voxr.example.com:80/api')).toBe(
			'ws://voxr.example.com/livekit',
		);
	});

	it('maps https to wss and http to ws', () => {
		expect(resolveLivekitEndpoint(undefined, 'https://voxr.example.com/api')).toBe(
			'wss://voxr.example.com/livekit',
		);
		expect(resolveLivekitEndpoint(undefined, 'http://voxr.example.com/api')).toBe('ws://voxr.example.com/livekit');
	});

	it('brackets ipv6 literals so the derived endpoint stays parseable', () => {
		expect(resolveLivekitEndpoint(undefined, 'http://[::1]:19480/api')).toBe('ws://[::1]:19480/livekit');
		expect(resolveLivekitEndpoint(undefined, 'https://[2001:db8::1]/api')).toBe('wss://[2001:db8::1]/livekit');
		const derived = new URL(resolveLivekitEndpoint(undefined, 'http://[::1]:19480/api'));
		expect(derived.host).toBe('[::1]:19480');
		expect(derived.pathname).toBe('/livekit');
	});

	it('returns the configured voice url unchanged when one is set', () => {
		expect(resolveLivekitEndpoint('wss://voice.example.com', 'http://inplace.localhost:19480/api')).toBe(
			'wss://voice.example.com',
		);
	});
});
