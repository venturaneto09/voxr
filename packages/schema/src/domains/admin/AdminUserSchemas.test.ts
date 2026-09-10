// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminACLs} from '@voxr/constants/src/AdminACLs';
import {SetUserAclsRequest} from '@voxr/schema/src/domains/admin/AdminUserSchemas';
import {describe, expect, test} from 'vitest';

describe('SetUserAclsRequest', () => {
	test('accepts every ACL the instance defines', () => {
		const acls = Object.values(AdminACLs);
		const result = SetUserAclsRequest.safeParse({user_id: '1', acls});
		expect(result.success).toBe(true);
	});

	test('rejects an ACL outside the registry', () => {
		const result = SetUserAclsRequest.safeParse({user_id: '1', acls: ['user:veiw']});
		expect(result.success).toBe(false);
	});

	test('rejects more entries than there are ACLs', () => {
		const acls = [...Object.values(AdminACLs), 'overflow:one'];
		const result = SetUserAclsRequest.safeParse({user_id: '1', acls});
		expect(result.success).toBe(false);
	});
});
