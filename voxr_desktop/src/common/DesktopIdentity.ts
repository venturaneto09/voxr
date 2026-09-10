// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';

export const DESKTOP_APP_NAME = BUILD_CHANNEL === 'canary' ? 'Voxr Canary' : 'Voxr';
export const MACOS_BUNDLE_ID = BUILD_CHANNEL === 'canary' ? 'app.voxr.canary' : 'app.voxr';
export const LINUX_DESKTOP_ENTRY_ID = BUILD_CHANNEL === 'canary' ? 'voxr-canary' : 'voxr';
export const WINDOWS_SHORTCUT_AUTHOR = 'Voxr Platform AB';
const WINDOWS_VELOPACK_ID = BUILD_CHANNEL === 'canary' ? 'voxr_desktop_canary' : 'voxr_desktop';
export const WINDOWS_APP_USER_MODEL_ID = BUILD_CHANNEL === 'canary' ? 'Voxr.Voxr.Canary' : 'Voxr.Voxr';
export const WINDOWS_LEGACY_APP_USER_MODEL_IDS = [`velopack.${WINDOWS_VELOPACK_ID}`];
export const WINDOWS_TOAST_ACTIVATOR_CLSID =
	BUILD_CHANNEL === 'canary' ? '{9CEDB5C0-3552-43B0-A279-2232E0CDF74C}' : '{48EEF21B-F3AE-431E-8CF2-386FFB2143F2}';
