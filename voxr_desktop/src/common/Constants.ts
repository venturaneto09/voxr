// SPDX-License-Identifier: AGPL-3.0-or-later

export const APP_PROTOCOL = 'voxr';
// Baked in at build time: changing where the app points needs a rebuild, or the
// --voxr-app-url flag at launch.
export const STABLE_APP_URL = 'http://localhost:19080';
export const CANARY_APP_URL = 'https://web.canary.voxr.app';
export const STATIC_CDN_URL = 'http://localhost:19080';
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;
