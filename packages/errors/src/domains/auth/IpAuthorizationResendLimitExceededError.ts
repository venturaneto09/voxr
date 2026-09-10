// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class IpAuthorizationResendLimitExceededError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.IP_AUTHORIZATION_RESEND_LIMIT_EXCEEDED});
	}
}
