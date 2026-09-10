// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class DonationMagicLinkExpiredError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.DONATION_MAGIC_LINK_EXPIRED,
		});
	}
}
