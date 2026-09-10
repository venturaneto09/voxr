// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class InvalidFlagsFormatError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.INVALID_FLAGS_FORMAT});
	}
}
