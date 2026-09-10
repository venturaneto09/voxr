// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class BlueskyOAuthNotEnabledError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.BLUESKY_OAUTH_NOT_ENABLED});
	}
}
