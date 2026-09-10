// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {ConflictError} from '@voxr/errors/src/domains/core/ConflictError';

export class DiscoveryAlreadyAppliedError extends ConflictError {
	constructor() {
		super({
			code: APIErrorCodes.DISCOVERY_ALREADY_APPLIED,
		});
	}
}
