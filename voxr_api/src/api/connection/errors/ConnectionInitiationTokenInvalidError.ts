// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class ConnectionInitiationTokenInvalidError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.CONNECTION_INITIATION_TOKEN_INVALID});
	}
}
