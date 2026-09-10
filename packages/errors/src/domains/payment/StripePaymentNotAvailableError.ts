// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class StripePaymentNotAvailableError extends VoxrError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_PAYMENT_NOT_AVAILABLE,
			status: 400,
		});
	}
}
