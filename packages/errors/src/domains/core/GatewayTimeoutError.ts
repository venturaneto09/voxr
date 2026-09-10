// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@voxr/constants/src/ApiErrorCodes';
import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError, type VoxrErrorData} from '@voxr/errors/src/VoxrError';

export class GatewayTimeoutError extends VoxrError {
	constructor({
		code = APIErrorCodes.GATEWAY_TIMEOUT,
		message,
		data,
		headers,
		messageVariables,
	}: {
		code?: APIErrorCode;
		message?: string;
		data?: VoxrErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	} = {}) {
		super({code, message, status: 504, data, headers, messageVariables});
	}
}
