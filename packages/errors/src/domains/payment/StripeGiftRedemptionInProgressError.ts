// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class StripeGiftRedemptionInProgressError extends VoxrError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_GIFT_REDEMPTION_IN_PROGRESS,
			status: 400,
		});
	}
}
