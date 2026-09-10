// SPDX-License-Identifier: AGPL-3.0-or-later

import * as CodeLinkUtils from '@app/features/messaging/utils/CodeLinkUtils';
import {describe, expect, it} from 'vitest';

import {extractEmbeddableCodeLinkContent} from './EmbeddableCodeLinkContent';

const TEST_LINK_CONFIG: CodeLinkUtils.CodeLinkConfig = {
	path: 'invite',
	urlBases: ['https://voxr.app/invite'],
};

function findCodes(content: string): Array<string> {
	return CodeLinkUtils.findCodes(extractEmbeddableCodeLinkContent(content), TEST_LINK_CONFIG);
}

function findSpoileredCodes(content: string): Array<string> {
	return CodeLinkUtils.findSpoileredCodeMatches(extractEmbeddableCodeLinkContent(content), TEST_LINK_CONFIG).map(
		(match) => match.code,
	);
}

describe('extractEmbeddableCodeLinkContent', () => {
	it('excludes inline and block code links from code-link detection', () => {
		const content = [
			'https://voxr.app/invite/visible',
			'`https://voxr.app/invite/inline-code`',
			'```',
			'https://voxr.app/invite/block-code',
			'```',
		].join('\n');

		expect(findCodes(content)).toEqual(['visible']);
	});

	it('keeps masked link URLs and preserves suppressed angle-link behavior', () => {
		const content = [
			'[Join](https://voxr.app/invite/masked-link)',
			'<https://voxr.app/invite/suppressed-link>',
		].join('\n');

		expect(findCodes(content)).toEqual(['masked-link']);
	});

	it('preserves suppressed angle-link behavior after parsing markdown code', () => {
		const content = ['<https://voxr.app/invite/suppressed-link>', '`not a link`'].join('\n');

		expect(findCodes(content)).toEqual([]);
	});

	it('excludes code links from spoilered code-link detection', () => {
		const content = [
			'||https://voxr.app/invite/visible-spoiler||',
			'||`https://voxr.app/invite/inline-spoiler`||',
			'```',
			'||https://voxr.app/invite/block-spoiler||',
			'```',
		].join('\n');

		expect(findSpoileredCodes(content)).toEqual(['visible-spoiler']);
	});
});
