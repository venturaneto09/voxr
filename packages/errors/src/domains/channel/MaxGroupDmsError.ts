// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class MaxGroupDmsError extends BadRequestError {
	constructor(limit: number) {
		super({
			code: APIErrorCodes.MAX_GROUP_DMS,
			messageVariables: {count: limit},
			data: {
				max_group_dms: limit,
			},
		});
	}
}
