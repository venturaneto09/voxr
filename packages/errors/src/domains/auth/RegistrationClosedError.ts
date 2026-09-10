// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';

export class RegistrationClosedError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.REGISTRATION_CLOSED});
		this.name = 'RegistrationClosedError';
	}
}
