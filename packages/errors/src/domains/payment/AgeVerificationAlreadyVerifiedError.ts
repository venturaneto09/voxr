// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class AgeVerificationAlreadyVerifiedError extends VoxrError {
	constructor() {
		super({
			code: APIErrorCodes.AGE_VERIFICATION_ALREADY_VERIFIED,
			status: 400,
		});
	}
}
