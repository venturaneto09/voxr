// SPDX-License-Identifier: AGPL-3.0-or-later

#pragma once

#include <stddef.h>
#include <stdint.h>
#include <webp/encode.h>

struct voxr_webp_animation_facts {
    uint32_t canvas_width;
    uint32_t canvas_height;
    uint32_t frame_count;
};

int voxr_webp_animation_preflight(
    const void *webp_data,
    size_t webp_len,
    int max_frames,
    size_t max_total_pixels,
    long long deadline_monotonic_ms,
    struct voxr_webp_animation_facts *facts
);

int voxr_configure_webp_encoder(
    WebPConfig *config,
    int quality,
    int lossless,
    int effort,
    int alpha_q,
    int smart_subsample
);

enum voxr_webp_pixel_layout {
    VOXR_WEBP_PIXEL_LAYOUT_RGBA = 0,
    VOXR_WEBP_PIXEL_LAYOUT_BGRA = 1
};

struct voxr_webp_animation_encoder;

struct voxr_webp_animation_encoder_settings {
    const WebPConfig *config;
    int canvas_width;
    int canvas_height;
    int loop_count;
    int full_canvas_frames;
    enum voxr_webp_pixel_layout pixel_layout;
    long long deadline_monotonic_ms;
    size_t max_output_size;
};

int voxr_webp_animation_encoder_create(
    const struct voxr_webp_animation_encoder_settings *settings,
    struct voxr_webp_animation_encoder **out_encoder
);

int voxr_webp_animation_encoder_add(
    struct voxr_webp_animation_encoder *encoder,
    const uint8_t *pixels,
    size_t stride,
    int duration_ms
);

int voxr_webp_animation_encoder_finish(
    struct voxr_webp_animation_encoder *encoder,
    void **out_buf,
    size_t *out_size
);

void voxr_webp_animation_encoder_delete(
    struct voxr_webp_animation_encoder *encoder
);
