// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@voxr/constants/src/LimitConfigMetadata';
import {applyRuleToResolvedLimits} from '@voxr/limits/src/LimitRuleRuntime';
import type {EvaluationContext, LimitRule} from '@voxr/limits/src/LimitTypes';

export function mergeRuleIntoResolved(
	resolved: Record<LimitKey, number>,
	rule: LimitRule,
	evaluationContext: EvaluationContext,
): void {
	applyRuleToResolvedLimits(resolved, rule, evaluationContext);
}
