// SPDX-License-Identifier: AGPL-3.0-or-later

import {getConfig} from '@voxr/config/src/ConfigLoader';
import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export class MaxBookmarksError extends BadRequestError {
	constructor(params: {
		maxBookmarks: number;
		isPremium?: boolean;
	}) {
		const {maxBookmarks, isPremium} = params;
		const config = getConfig();
		const selfHosted = 'self_hosted' in config ? config.self_hosted : false;
		super({
			code: APIErrorCodes.MAX_BOOKMARKS,
			messageVariables: {count: maxBookmarks},
			data: {
				max_bookmarks: maxBookmarks,
				...(selfHosted || isPremium === undefined ? {} : {is_premium: isPremium}),
			},
		});
	}
}
