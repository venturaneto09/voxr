// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class CannotSendFriendRequestToBlockedUserError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.CANNOT_SEND_FRIEND_REQUEST_TO_BLOCKED_USER,
		});
	}
}
