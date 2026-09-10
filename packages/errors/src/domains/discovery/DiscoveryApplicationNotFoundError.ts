// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {NotFoundError} from '@voxr/errors/src/domains/core/NotFoundError';

export class DiscoveryApplicationNotFoundError extends NotFoundError {
	constructor() {
		super({
			code: APIErrorCodes.DISCOVERY_APPLICATION_NOT_FOUND,
		});
	}
}
