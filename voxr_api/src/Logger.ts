// SPDX-License-Identifier: AGPL-3.0-or-later

import {createLogger, type Logger as VoxrLogger} from '@voxr/logger/src/Logger';

export const Logger = createLogger('voxr-api');

export type Logger = VoxrLogger;
