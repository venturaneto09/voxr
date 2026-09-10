// SPDX-License-Identifier: AGPL-3.0-or-later

import {InviteTypes} from '@voxr/constants/src/ChannelConstants';
import type {ValueOf} from '@voxr/constants/src/ValueOf';
import type {GroupDmInvite, GuildInvite, Invite} from '@voxr/schema/src/domains/invite/InviteSchemas';

export type InviteTypeValue = ValueOf<typeof InviteTypes>;

export const isGuildInvite = (invite: Invite): invite is GuildInvite => invite.type === InviteTypes.GUILD;
export const isGroupDmInvite = (invite: Invite): invite is GroupDmInvite => invite.type === InviteTypes.GROUP_DM;
