// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@voxr/constants/src/LimitConfigMetadata';
import type {ILimitEvaluator} from '@voxr/limits/src/ILimitEvaluator';
import {DEFAULT_FREE_LIMITS} from '@voxr/limits/src/LimitDefaults';
import {applyRuleToResolvedLimits, ruleMatches, sortRulesBySpecificity} from '@voxr/limits/src/LimitRuleRuntime';
import type {
	LimitConfigSnapshot,
	LimitEvaluationOptions,
	LimitEvaluationResult,
	LimitMatchContext,
	LimitRule,
} from '@voxr/limits/src/LimitTypes';

export class LimitEvaluator implements ILimitEvaluator {
	private readonly sortedRules: Array<LimitRule>;

	constructor(snapshot: LimitConfigSnapshot) {
		this.sortedRules = sortRulesBySpecificity(snapshot.rules);
	}

	resolveAll(ctx: LimitMatchContext, options?: LimitEvaluationOptions): LimitEvaluationResult {
		const evaluationContext = options?.evaluationContext ?? 'user';
		const baseLimits = options?.baseLimits ?? DEFAULT_FREE_LIMITS;
		const resolvedLimits = {...baseLimits};
		for (const rule of this.sortedRules) {
			if (!ruleMatches(rule.filters, ctx)) {
				continue;
			}
			applyRuleToResolvedLimits(resolvedLimits, rule, evaluationContext);
		}
		return {
			limits: resolvedLimits,
		};
	}

	resolveOne(ctx: LimitMatchContext, key: LimitKey, options?: LimitEvaluationOptions): number {
		return this.resolveAll(ctx, options).limits[key];
	}
}
