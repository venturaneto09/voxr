// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError} from '@voxr/errors/src/VoxrError';

export class StripeInvalidProductConfigurationError extends VoxrError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_INVALID_PRODUCT_CONFIGURATION,
			status: 400,
		});
	}
}
