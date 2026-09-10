// SPDX-License-Identifier: AGPL-3.0-or-later

function getBootstrapProductName(): string {
	if (typeof window === 'undefined') {
		return 'Voxr';
	}
	const productName = window.__VOXR_BOOTSTRAP__?.instance.app_public?.branding?.product_name?.trim();
	return productName || 'Voxr';
}

export const PRODUCT_NAME = getBootstrapProductName();
export const PREMIUM_PRODUCT_NAME = 'Plutonium';
export const PREMIUM_PRODUCT_FULL_NAME = `${PRODUCT_NAME} ${PREMIUM_PRODUCT_NAME}`;
