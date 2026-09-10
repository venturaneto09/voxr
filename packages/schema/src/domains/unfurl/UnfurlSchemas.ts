// SPDX-License-Identifier: AGPL-3.0-or-later

import {MessageEmbedResponse} from '@voxr/schema/src/domains/message/EmbedSchemas';
import {URLType} from '@voxr/schema/src/primitives/UrlValidators';
import {z} from 'zod';

export const UnfurlRequest = z.object({
	url: URLType.describe('The URL to unfurl'),
});

export type UnfurlRequest = z.infer<typeof UnfurlRequest>;

export const UnfurlResponse = z.array(MessageEmbedResponse).describe('The embeds resolved by the unfurler');

export type UnfurlResponse = z.infer<typeof UnfurlResponse>;
