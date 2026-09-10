// SPDX-License-Identifier: AGPL-3.0-or-later

type VoxrDebugObject = NonNullable<Window['__VOXR_DEBUG__']>;

export function getVoxrDebugObject(): VoxrDebugObject | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const existing = window.__VOXR_DEBUG__;
	if (existing === undefined || existing === null) {
		const created: VoxrDebugObject = {};
		window.__VOXR_DEBUG__ = created;
		return created;
	}
	if (typeof existing !== 'object' || Array.isArray(existing)) {
		return null;
	}
	return existing;
}
