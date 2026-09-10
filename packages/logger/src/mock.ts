// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LoggerInterface} from '@voxr/logger/src/LoggerInterface';

export function createMockLogger(): LoggerInterface {
	const logger: LoggerInterface = {
		trace: () => {},
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
		child: () => logger,
	};
	return logger;
}
