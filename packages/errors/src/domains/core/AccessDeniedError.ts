// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class AccessDeniedError extends VoxrError {
	constructor() {
		super({code: APIErrorCodes.ACCESS_DENIED, status: 403});
	}
}
