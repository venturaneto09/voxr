// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';

export class AccountSuspiciousActivityError extends ForbiddenError {
	constructor(suspiciousActivityFlags: number) {
		super({
			code: APIErrorCodes.ACCOUNT_SUSPICIOUS_ACTIVITY,
			data: {
				data: {
					suspicious_activity_flags: suspiciousActivityFlags,
				},
			},
		});
	}
}
