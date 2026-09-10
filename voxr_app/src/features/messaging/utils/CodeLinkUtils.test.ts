// SPDX-License-Identifier: AGPL-3.0-or-later

import {type CodeLinkConfig, findCodes, findSpoileredCodeMatches} from '@app/features/messaging/utils/CodeLinkUtils';
import {describe, expect, it} from 'vitest';

const INVITE_CONFIG: CodeLinkConfig = {
	path: 'invite',
	urlBases: ['https://voxr.app/invite', 'https://voxr.gg', 'https://voxr.gg/invite'],
};

describe('CodeLinkUtils', () => {
	it('finds spoilered code-link matches with the same URL rules as code extraction', () => {
		const content = [
			'https://voxr.app/invite/visible',
			'||https://voxr.app/invite/secret||',
			'||voxr.gg/short||',
			'||https://voxr.gg/invite/pathlink||',
			'||https://voxr.app/invite/secret https://voxr.gg/secret||',
			'||<https://voxr.app/invite/suppressed>||',
		].join(' ');
		expect(findCodes(content, INVITE_CONFIG)).toEqual(['visible', 'secret', 'short', 'pathlink']);
		expect(findSpoileredCodeMatches(content, INVITE_CONFIG).map((match) => match.code)).toEqual([
			'secret',
			'short',
			'pathlink',
			'secret',
			'secret',
		]);
	});
});
