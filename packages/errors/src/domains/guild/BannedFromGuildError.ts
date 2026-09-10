// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';

export class BannedFromGuildError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.USER_BANNED_FROM_GUILD});
	}
}
