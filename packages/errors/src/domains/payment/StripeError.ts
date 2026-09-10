// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class StripeError extends VoxrError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.STRIPE_ERROR,
			status: 400,
			data: detail ? {detail} : undefined,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
