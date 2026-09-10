// SPDX-License-Identifier: AGPL-3.0-or-later

import {ValidationErrorCodes} from '@voxr/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@voxr/errors/src/domains/core/InputValidationError';
import {AuditLogReasonType} from '@voxr/schema/src/primitives/ChannelValidators';
import {createMiddleware} from 'hono/factory';
import type {HonoEnv} from '../types/HonoEnv';

export const AuditLogMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const auditLogReasonHeader = ctx.req.header('X-Audit-Log-Reason');
	if (auditLogReasonHeader) {
		const result = AuditLogReasonType.safeParse(auditLogReasonHeader);
		if (!result.success) {
			throw InputValidationError.fromCode('X-Audit-Log-Reason', ValidationErrorCodes.INVALID_AUDIT_LOG_REASON);
		}
		ctx.set('auditLogReason', result.data);
	} else {
		ctx.set('auditLogReason', null);
	}
	await next();
});
