// SPDX-License-Identifier: AGPL-3.0-or-later

import {sanitizeRetryAfterSeconds} from '@voxr/errors/src/domains/core/RetryAfterSeconds';
import {VoxrError, type VoxrErrorData} from '@voxr/errors/src/VoxrError';

export class ThrottledError extends VoxrError {
	constructor({
		code,
		message,
		retryAfterSeconds,
		data,
		headers,
		messageVariables,
	}: {
		code: string;
		message?: string;
		retryAfterSeconds: number;
		data?: VoxrErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({
			code,
			message,
			status: 429,
			data,
			headers: {...headers, 'Retry-After': sanitizeRetryAfterSeconds(retryAfterSeconds).toString()},
			messageVariables,
		});
	}
}
