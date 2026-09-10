// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig, {DEFAULT_APP_PUBLIC_CONFIG} from '@app/features/app/state/RuntimeConfig';
import VoxrWordmarkMonochromeAsset from '@app/media/images/voxr-logo-wordmark-monochrome.svg?react';
import VoxrWordmarkAsset from '@app/media/images/voxr-wordmark.svg?react';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {type BrandSvgProps, getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_WORDMARK_DESCRIPTOR = msg({
	message: '{productName} wordmark',
	comment: 'Accessible label for the application wordmark.',
});

interface VoxrWordmarkProps extends BrandSvgProps {
	variant?: 'default' | 'monochrome';
}

export const VoxrWordmark = observer(({variant = 'default', ...props}: VoxrWordmarkProps) => {
	const {i18n} = useLingui();
	const productName = RuntimeConfig.productName;
	const ariaLabel = i18n._(APPLICATION_WORDMARK_DESCRIPTOR, {productName});
	if (RuntimeConfig.wordmarkUrl) {
		return (
			<img
				{...getImageSizingProps(props)}
				src={RuntimeConfig.wordmarkUrl}
				alt={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.voxr-wordmark.img')}
			/>
		);
	}
	if (productName !== DEFAULT_APP_PUBLIC_CONFIG.branding.product_name) {
		const style: React.CSSProperties = {
			...(props.style as React.CSSProperties | undefined),
			alignItems: 'center',
			display: 'inline-flex',
			fontWeight: 800,
			lineHeight: 1,
		};
		return (
			<span
				className={props.className}
				style={style}
				role="img"
				aria-label={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.voxr-wordmark.text')}
			>
				{productName}
			</span>
		);
	}
	const Asset = variant === 'monochrome' ? VoxrWordmarkMonochromeAsset : VoxrWordmarkAsset;
	return <Asset role="img" aria-label={ariaLabel} data-flx="ui.icons.voxr-wordmark.img" {...props} />;
});
