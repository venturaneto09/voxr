// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class InvalidTimestampError extends BadRequestError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.INVALID_TIMESTAMP,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
