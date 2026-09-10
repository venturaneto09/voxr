// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class StripeWebhookSignatureInvalidError extends VoxrError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_WEBHOOK_SIGNATURE_INVALID,
			status: 401,
		});
	}
}
