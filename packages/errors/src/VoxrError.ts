// SPDX-License-Identifier: AGPL-3.0-or-later

import {HTTPException} from 'hono/http-exception';

export type VoxrErrorData = Record<string, unknown>;
export type VoxrErrorStatus = HTTPException['status'];

interface VoxrErrorOptions {
	code: string;
	message?: string;
	status: VoxrErrorStatus;
	data?: VoxrErrorData;
	headers?: Record<string, string>;
	messageVariables?: Record<string, unknown>;
	cause?: Error;
}

export class VoxrError extends HTTPException {
	readonly code: string;
	override readonly message: string;
	override readonly status: VoxrErrorStatus;
	readonly data?: VoxrErrorData;
	readonly headers?: Record<string, string>;
	readonly messageVariables?: Record<string, unknown>;

	constructor(options: VoxrErrorOptions) {
		const resolvedMessage = options.message ?? options.code;
		super(options.status, {message: resolvedMessage, cause: options.cause});
		this.code = options.code;
		this.message = resolvedMessage;
		this.status = options.status;
		this.data = options.data;
		this.headers = options.headers;
		this.messageVariables = options.messageVariables;
		this.name = 'VoxrError';
	}

	override getResponse(): Response {
		return new Response(
			JSON.stringify({
				code: this.code,
				message: this.message,
				...this.data,
			}),
			{
				status: this.status,
				headers: {
					'Content-Type': 'application/json',
					...this.headers,
				},
			},
		);
	}

	toJSON(): Record<string, unknown> {
		return {
			code: this.code,
			message: this.message,
			...this.data,
		};
	}
}
