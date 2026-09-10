// SPDX-License-Identifier: AGPL-3.0-or-later

import {Headers as HttpHeaders} from '@voxr/constants/src/Headers';
import type {MiddlewareHandler} from 'hono';

function resolveVoxrVersion(): string {
	const value = process.env.BUILD_VERSION?.trim();
	return value && value.length > 0 ? value : 'dev';
}

export function applyVoxrVersionHeader(response: Response, version = resolveVoxrVersion()): Response {
	const headers = new Headers(response.headers);
	headers.set(HttpHeaders.X_VOXR_VERSION, version);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function voxrVersionHeader(version = resolveVoxrVersion()): MiddlewareHandler {
	return async (c, next) => {
		await next();
		c.res.headers.set(HttpHeaders.X_VOXR_VERSION, version);
	};
}
