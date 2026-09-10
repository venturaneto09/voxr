// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';

export class ReportBannedError extends ForbiddenError {
	constructor() {
		super({
			code: APIErrorCodes.REPORT_BANNED,
		});
	}
}
