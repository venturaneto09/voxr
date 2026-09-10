// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class StreamKeyScopeMismatchError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.STREAM_KEY_SCOPE_MISMATCH});
	}
}
