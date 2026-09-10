// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	calculateSpecificity as calculateRuntimeSpecificity,
	compareSpecificity as compareRuntimeSpecificity,
} from '@voxr/limits/src/LimitRuleRuntime';
import type {LimitFilter} from '@voxr/limits/src/LimitTypes';

export function calculateSpecificity(filters: LimitFilter | undefined): number {
	return calculateRuntimeSpecificity(filters);
}

export function compareSpecificity(a: LimitFilter | undefined, b: LimitFilter | undefined): number {
	return compareRuntimeSpecificity(a, b);
}
