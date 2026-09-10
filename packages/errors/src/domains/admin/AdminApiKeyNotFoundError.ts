// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {NotFoundError} from '@voxr/errors/src/domains/core/NotFoundError';

export class AdminApiKeyNotFoundError extends NotFoundError {
	constructor(messageVariables?: Record<string, unknown>) {
		super({
			code: APIErrorCodes.ADMIN_API_KEY_NOT_FOUND,
			messageVariables,
		});
	}
}
