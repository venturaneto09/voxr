// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class BotAlreadyInGuildError extends BadRequestError {
	constructor(messageVariables?: Record<string, unknown>) {
		super({
			code: APIErrorCodes.BOT_ALREADY_IN_GUILD,
			messageVariables,
		});
	}
}
