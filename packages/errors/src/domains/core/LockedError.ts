// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@voxr/constants/src/ApiErrorCodes';
import {VoxrError, type VoxrErrorData} from '@voxr/errors/src/VoxrError';

export class LockedError extends VoxrError {
	constructor({
		code,
		headers,
		data,
		messageVariables,
	}: {
		code: APIErrorCode;
		data?: VoxrErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({code, status: 423, data, headers, messageVariables});
	}
}
