// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class MaxGuildStickersStaticError extends BadRequestError {
	constructor(maxStickers: number) {
		super({
			code: APIErrorCodes.MAX_STICKERS,
			messageVariables: {count: maxStickers},
		});
	}
}
