// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildFeature} from '@voxr/constants/src/GuildConstants';

export function mapGuildFeatures(features: ReadonlySet<string>): Array<GuildFeature> {
	return Array.from(features) as Array<GuildFeature>;
}
