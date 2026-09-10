// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@voxr/constants/src/ApiErrorCodes';
import {BadRequestError} from '@voxr/errors/src/domains/core/BadRequestError';

export type GroupDmRecipientNotAddableReason = 'unknown_user' | 'blocked' | 'not_friends' | 'group_dm_add_disabled';

export interface GroupDmUnaddableRecipient {
	user_id: string;
	reason: GroupDmRecipientNotAddableReason;
}

export class GroupDmRecipientsNotAddableError extends BadRequestError {
	constructor({
		unaddableRecipients,
		addableRecipients,
	}: {
		unaddableRecipients: Array<GroupDmUnaddableRecipient>;
		addableRecipients: Array<string>;
	}) {
		super({
			code: APIErrorCodes.GROUP_DM_RECIPIENTS_NOT_ADDABLE,
			data: {
				unaddable_recipients: unaddableRecipients,
				addable_recipients: addableRecipients,
			},
		});
	}
}
