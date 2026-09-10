// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class CannotSendMessagesToUserError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.CANNOT_SEND_MESSAGES_TO_USER});
	}
}
