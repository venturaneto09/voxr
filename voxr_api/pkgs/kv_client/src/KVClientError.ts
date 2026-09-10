// SPDX-License-Identifier: AGPL-3.0-or-later

import {HttpStatus} from '@voxr/constants/src/HttpConstants';
import {VoxrError, type VoxrErrorStatus} from '@voxr/errors/src/VoxrError';

export const KVClientErrorCode = {
	INVALID_ARGUMENT: 'KV_CLIENT_INVALID_ARGUMENT',
	INVALID_RESPONSE: 'KV_CLIENT_INVALID_RESPONSE',
	REQUEST_FAILED: 'KV_CLIENT_REQUEST_FAILED',
	TIMEOUT: 'KV_CLIENT_TIMEOUT',
} as const;

interface KVClientErrorInit {
	code: string;
	message: string;
	status?: VoxrErrorStatus;
}

export class KVClientError extends VoxrError {
	constructor(init: KVClientErrorInit) {
		super({
			code: init.code,
			message: init.message,
			status: init.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
		});
		this.name = 'KVClientError';
	}
}
