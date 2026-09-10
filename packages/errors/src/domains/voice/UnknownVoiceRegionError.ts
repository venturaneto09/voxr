// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {NotFoundError} from '@voxr/errors/src/domains/core/NotFoundError';

export class UnknownVoiceRegionError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_VOICE_REGION});
	}
}
