// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@voxr/errors/src/domains/core/ForbiddenError';
import type {VoxrErrorData} from '@voxr/errors/src/VoxrError';

type PremiumPurchaseBlockedReason = 'lifetime' | 'existing_subscription' | 'purchase_disabled';

export class PremiumPurchaseBlockedError extends ForbiddenError {
	constructor(reason: PremiumPurchaseBlockedReason = 'purchase_disabled', data: VoxrErrorData = {}) {
		super({
			code: APIErrorCodes.PREMIUM_PURCHASE_BLOCKED,
			data: {
				...data,
				reason,
			},
		});
	}
}
