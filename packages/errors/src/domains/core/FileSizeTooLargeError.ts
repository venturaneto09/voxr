// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class FileSizeTooLargeError extends BadRequestError {
	constructor(maxSize?: number) {
		super({
			code: APIErrorCodes.FILE_SIZE_TOO_LARGE,
			...(maxSize != null ? {messageVariables: {maxSize}} : {}),
		});
	}
}
