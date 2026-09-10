// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@voxr/constants/src/LimitConfigMetadata';
import {resolveLimit} from '@voxr/limits/src/LimitResolver';
import type {EvaluationContext, LimitConfigSnapshot, LimitMatchContext} from '@voxr/limits/src/LimitTypes';

export function resolveLimitSafe(
	snapshot: LimitConfigSnapshot | null | undefined,
	ctx: LimitMatchContext,
	key: LimitKey,
	fallback: number,
	evaluationContext: EvaluationContext = 'user',
): number {
	if (!snapshot) {
		return fallback;
	}
	const resolved = resolveLimit(snapshot, ctx, key, {evaluationContext});
	if (Number.isFinite(resolved) && resolved >= 0) {
		return resolved;
	}
	return fallback;
}
