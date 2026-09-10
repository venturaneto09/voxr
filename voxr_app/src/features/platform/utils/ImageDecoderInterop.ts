// SPDX-License-Identifier: AGPL-3.0-or-later

export interface VoxrImageDecoderInit {
	data: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView;
	type: string;
	preferAnimation?: boolean;
}

export interface VoxrImageDecoderDecodedFrame {
	image: VideoFrame;
	complete: boolean;
}

export interface VoxrImageDecoderTrack {
	animated: boolean;
	frameCount: number;
	repetitionCount?: number;
}

export interface VoxrImageDecoderInstance {
	decode(options?: {frameIndex?: number; completeFramesOnly?: boolean}): Promise<VoxrImageDecoderDecodedFrame>;
	tracks: {
		selectedTrack: VoxrImageDecoderTrack | null;
	};
	completed: Promise<void>;
	close(): void;
}

export interface VoxrImageDecoderConstructor {
	new (init: VoxrImageDecoderInit): VoxrImageDecoderInstance;
	isTypeSupported(type: string): Promise<boolean>;
}

export type Canvas2DContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function isImageDecoderConstructor(value: unknown): value is VoxrImageDecoderConstructor {
	if (typeof value !== 'function') return false;
	const candidate = value as {isTypeSupported?: unknown};
	return typeof candidate.isTypeSupported === 'function';
}

export function getImageDecoderConstructor(): VoxrImageDecoderConstructor | null {
	const candidate: unknown = Reflect.get(globalThis, 'ImageDecoder');
	return isImageDecoderConstructor(candidate) ? candidate : null;
}

export function drawVideoFrameToCanvas(ctx: Canvas2DContext, image: VideoFrame, x = 0, y = 0): void {
	ctx.drawImage(image as VideoFrame & CanvasImageSource, x, y);
}
