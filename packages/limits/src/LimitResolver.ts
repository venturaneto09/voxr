// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@voxr/constants/src/LimitConfigMetadata';
import type {ILimitEvaluator} from '@voxr/limits/src/ILimitEvaluator';
import {LimitEvaluator} from '@voxr/limits/src/LimitEvaluator';
import type {
	LimitConfigSnapshot,
	LimitEvaluationOptions,
	LimitEvaluationResult,
	LimitMatchContext,
} from '@voxr/limits/src/LimitTypes';

export function createLimitEvaluator(snapshot: LimitConfigSnapshot): ILimitEvaluator {
	return new LimitEvaluator(snapshot);
}

export function resolveLimits(
	snapshot: LimitConfigSnapshot,
	ctx: LimitMatchContext,
	options?: LimitEvaluationOptions,
): LimitEvaluationResult {
	const evaluator = createLimitEvaluator(snapshot);
	return evaluator.resolveAll(ctx, options);
}

export function resolveLimit(
	snapshot: LimitConfigSnapshot,
	ctx: LimitMatchContext,
	key: LimitKey,
	options?: LimitEvaluationOptions,
): number {
	const evaluator = createLimitEvaluator(snapshot);
	return evaluator.resolveOne(ctx, key, options);
}
