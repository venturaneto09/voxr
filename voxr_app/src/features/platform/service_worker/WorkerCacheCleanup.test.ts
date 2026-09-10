// SPDX-License-Identifier: AGPL-3.0-or-later

import {shouldDeleteWorkerCache} from '@app/features/platform/service_worker/WorkerCacheCleanup';
import {describe, expect, it} from 'vitest';

describe('WorkerCacheCleanup', () => {
	const expectedCaches = new Set(['voxr-precache-current', 'voxr-navigation-current']);

	it('reclaims every cache the current worker no longer writes to', () => {
		expect(shouldDeleteWorkerCache('voxr-assets-current', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('voxr-assets-previous', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('voxr-expression-assets', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('voxr-expression-assets-2026.604', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('voxr-precache-previous', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('voxr-navigation-previous', expectedCaches)).toBe(true);
	});

	it('keeps the current caches and anything the worker does not own', () => {
		expect(shouldDeleteWorkerCache('voxr-precache-current', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('voxr-navigation-current', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('third-party-cache', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('voxr', expectedCaches)).toBe(false);
	});
});
