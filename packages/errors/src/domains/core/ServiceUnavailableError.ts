// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError, type VoxrErrorData} from '@voxr/errors/src/VoxrError';

export class ServiceUnavailableError extends VoxrError {
	constructor({
		code = APIErrorCodes.SERVICE_UNAVAILABLE,
		message,
		data,
		headers,
		messageVariables,
	}: {
		code?: string;
		message?: string;
		data?: VoxrErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	} = {}) {
		super({code, message, status: 503, data, headers, messageVariables});
	}
}
