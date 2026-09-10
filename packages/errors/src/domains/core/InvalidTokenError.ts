// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class InvalidTokenError extends VoxrError {
	constructor() {
		super({code: APIErrorCodes.INVALID_TOKEN, status: 401});
	}
}
