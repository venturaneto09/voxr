// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class MaxGuildChannelsError extends BadRequestError {
	constructor(maxChannels: number) {
		super({
			code: APIErrorCodes.MAX_GUILD_CHANNELS,
			messageVariables: {count: maxChannels},
		});
	}
}
