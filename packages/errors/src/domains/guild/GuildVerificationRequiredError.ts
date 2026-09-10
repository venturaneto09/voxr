// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';

export class GuildVerificationRequiredError extends ForbiddenError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.GUILD_VERIFICATION_REQUIRED,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
