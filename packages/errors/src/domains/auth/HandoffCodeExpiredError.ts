// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class HandoffCodeExpiredError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.HANDOFF_CODE_EXPIRED});
	}
}
