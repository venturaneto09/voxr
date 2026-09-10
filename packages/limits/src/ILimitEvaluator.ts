// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@voxr/constants/src/LimitConfigMetadata';
import type {LimitEvaluationOptions, LimitEvaluationResult, LimitMatchContext} from '@voxr/limits/src/LimitTypes';

export interface ILimitEvaluator {
	resolveAll(ctx: LimitMatchContext, options?: LimitEvaluationOptions): LimitEvaluationResult;
	resolveOne(ctx: LimitMatchContext, key: LimitKey, options?: LimitEvaluationOptions): number;
}
