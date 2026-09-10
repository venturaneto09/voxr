// SPDX-License-Identifier: AGPL-3.0-or-later

import {makeSyncedField} from '@app/features/user/state/SyncedField';
import {TextualPreviewSettingsSchema} from '@voxr/schema/src/gen/voxr/user/preferences/v1/preferences_pb';
import {makeAutoObservable} from 'mobx';

class TextualPreview {
	wrapText = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void makeSyncedField(this, {
			field: 'textualPreview',
			schema: TextualPreviewSettingsSchema,
			persist: ['wrapText'],
			toMessage: (s) => ({wrapText: s.wrapText}),
			applyMessage: (s, m) => {
				s.wrapText = m.wrapText;
			},
		});
	}

	toggleWrapText(): void {
		this.wrapText = !this.wrapText;
	}
}

export default new TextualPreview();
