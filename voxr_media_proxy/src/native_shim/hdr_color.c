// SPDX-License-Identifier: AGPL-3.0-or-later

#include "native_shim_internal.h"

float voxr_pq_lut[VOXR_HDR_PQ_LUT_SIZE];
float voxr_hlg_lut[VOXR_HDR_HLG_LUT_SIZE];
float voxr_hlg_ootf_scale_lut[VOXR_HDR_HLG_LUT_SIZE];
float voxr_pq_tone_scale_lut[VOXR_HDR_PQ_LUT_SIZE];
float voxr_hlg_tone_scale_lut[VOXR_HDR_HLG_LUT_SIZE];
uint8_t voxr_srgb_lut[VOXR_HDR_SRGB_LUT_SIZE];
float voxr_pq_sdr_target_perceptual;
float voxr_hlg_source_peak_perceptual;
float voxr_hlg_sdr_target_perceptual;

static pthread_once_t voxr_hdr_lut_once = PTHREAD_ONCE_INIT;

static void voxr_init_hdr_luts(void) {
    const double m1 = 0.1593017578125;
    const double m2 = 78.84375;
    const double c1 = 0.8359375;
    const double c2 = 18.8515625;
    const double c3 = 18.6875;
    for (int index = 0; index < VOXR_HDR_PQ_LUT_SIZE; index++) {
        double encoded = (double)index / (VOXR_HDR_PQ_LUT_SIZE - 1);
        double encoded_power = pow(encoded, 1.0 / m2);
        double numerator = encoded_power - c1;
        if (numerator < 0.0) numerator = 0.0;
        double denominator = c2 - c3 * encoded_power;
        double luminance = denominator > 0.0
                         ? pow(numerator / denominator, 1.0 / m1)
                         : 0.0;
        if (luminance < 0.0) luminance = 0.0;
        if (luminance > 1.0) luminance = 1.0;
        voxr_pq_lut[index] = (float)luminance;
    }
    const double a = 0.17883277;
    const double b = 0.28466892;
    const double c = 0.55991073;
    for (int index = 0; index < VOXR_HDR_HLG_LUT_SIZE; index++) {
        double encoded = (double)index / (VOXR_HDR_HLG_LUT_SIZE - 1);
        double scene = encoded <= 0.5
                     ? (encoded * encoded) / 3.0
                     : (exp((encoded - c) / a) + b) / 12.0;
        if (scene < 0.0) scene = 0.0;
        if (scene > 1.0) scene = 1.0;
        voxr_hlg_lut[index] = (float)scene;
        double normalized = (double)index / (VOXR_HDR_HLG_LUT_SIZE - 1);
        voxr_hlg_ootf_scale_lut[index] = normalized > 0.0
                                         ? (float)pow(normalized, 0.2)
                                         : 0.0f;
    }
    voxr_pq_sdr_target_perceptual =
        voxr_pq_oetf(VOXR_PQ_SDR_TARGET_NORM);
    voxr_hlg_source_peak_perceptual =
        voxr_pq_oetf(VOXR_HLG_REFERENCE_PEAK_NORM);
    voxr_hlg_sdr_target_perceptual =
        voxr_pq_sdr_target_perceptual /
        voxr_hlg_source_peak_perceptual;
    for (int index = 0; index < VOXR_HDR_PQ_LUT_SIZE; index++) {
        voxr_pq_tone_scale_lut[index] = voxr_hdr_tone_scale(
            voxr_pq_lut[index], VOXR_PQ_SDR_TARGET_NORM,
            1.0f,
            voxr_pq_sdr_target_perceptual);
    }
    for (int index = 0; index < VOXR_HDR_HLG_LUT_SIZE; index++) {
        float maximum = (float)index / (VOXR_HDR_HLG_LUT_SIZE - 1);
        float absolute_maximum =
            maximum * VOXR_HLG_REFERENCE_PEAK_NORM;
        voxr_hlg_tone_scale_lut[index] =
            VOXR_HLG_REFERENCE_PEAK_NORM * voxr_hdr_tone_scale(
                absolute_maximum, VOXR_PQ_SDR_TARGET_NORM,
                voxr_hlg_source_peak_perceptual,
                voxr_hlg_sdr_target_perceptual);
    }
    for (int index = 0; index < VOXR_HDR_SRGB_LUT_SIZE; index++) {
        float linear = (float)index / (VOXR_HDR_SRGB_LUT_SIZE - 1);
        voxr_srgb_lut[index] = voxr_quantize8(
            voxr_srgb_oetf(linear));
    }
}

static inline uint16_t voxr_hdr_read_le16(const uint8_t *value) {
    return (uint16_t)((uint16_t)value[0] | ((uint16_t)value[1] << 8));
}

int voxr_hdr_luts_ready(void) {
    if (pthread_once(&voxr_hdr_lut_once, voxr_init_hdr_luts) != 0) {
        return VOXR_NATIVE_STATUS_CODEC_FAILURE;
    }
    return VOXR_NATIVE_STATUS_OK;
}

int voxr_hdr_transfer_is_hdr(int transfer) {
    return transfer == VOXR_HDR_TRANSFER_PQ ||
           transfer == VOXR_HDR_TRANSFER_HLG;
}

int voxr_hdr_apply_sdr_gamut(
    uint8_t *rgba,
    int width,
    int height,
    int gamut,
    int transfer,
    int deadline_rows,
    long long deadline_monotonic_ms
) {
    if (rgba == NULL || width <= 0 || height <= 0 || deadline_rows <= 0) {
        return VOXR_NATIVE_STATUS_CODEC_FAILURE;
    }
    if (voxr_hdr_transfer_is_hdr(transfer)) {
        return VOXR_NATIVE_STATUS_UNSUPPORTED;
    }
    if (transfer != VOXR_HDR_TRANSFER_SRGB &&
        transfer != VOXR_HDR_TRANSFER_BT709 &&
        transfer != VOXR_HDR_TRANSFER_BT2020_12 &&
        transfer != VOXR_HDR_TRANSFER_LINEAR) {
        return VOXR_NATIVE_STATUS_UNSUPPORTED;
    }
    if (transfer == VOXR_HDR_TRANSFER_SRGB &&
        gamut == VOXR_HDR_GAMUT_SRGB) {
        return VOXR_NATIVE_STATUS_OK;
    }
    int status = voxr_hdr_luts_ready();
    if (status != VOXR_NATIVE_STATUS_OK) return status;
    size_t row_bytes = (size_t)width * 4u;
    for (int row = 0; row < height; row++) {
        if (row % deadline_rows == 0) {
            status = voxr_native_deadline_status(deadline_monotonic_ms);
            if (status != VOXR_NATIVE_STATUS_OK) return status;
        }
        uint8_t *row_data = rgba + (size_t)row * row_bytes;
        for (int column = 0; column < width; column++) {
            uint8_t *pixel = row_data + (size_t)column * 4u;
            float red = (float)pixel[0] / 255.0f;
            float green = (float)pixel[1] / 255.0f;
            float blue = (float)pixel[2] / 255.0f;
            if (transfer == VOXR_HDR_TRANSFER_SRGB) {
                red = voxr_inverse_srgb(red);
                green = voxr_inverse_srgb(green);
                blue = voxr_inverse_srgb(blue);
            } else if (transfer == VOXR_HDR_TRANSFER_BT709) {
                red = voxr_inverse_bt709(red);
                green = voxr_inverse_bt709(green);
                blue = voxr_inverse_bt709(blue);
            } else if (transfer == VOXR_HDR_TRANSFER_BT2020_12) {
                red = voxr_inverse_bt2020_12(red);
                green = voxr_inverse_bt2020_12(green);
                blue = voxr_inverse_bt2020_12(blue);
            }
            float srgb_red = 0.0f;
            float srgb_green = 0.0f;
            float srgb_blue = 0.0f;
            voxr_hdr_convert_gamut_linear(
                gamut, red, green, blue,
                &srgb_red, &srgb_green, &srgb_blue);
            pixel[0] = voxr_quantize8(voxr_srgb_oetf(srgb_red));
            pixel[1] = voxr_quantize8(voxr_srgb_oetf(srgb_green));
            pixel[2] = voxr_quantize8(voxr_srgb_oetf(srgb_blue));
        }
    }
    return voxr_native_deadline_status(deadline_monotonic_ms);
}

int voxr_hdr_tone_map_rgba16(
    const uint8_t *source,
    size_t source_stride,
    uint8_t *destination,
    size_t destination_stride,
    int width,
    int height,
    int bit_depth,
    int gamut,
    int transfer,
    int deadline_rows,
    long long deadline_monotonic_ms
) {
    if (source == NULL || destination == NULL || width <= 0 || height <= 0 ||
        deadline_rows <= 0) {
        return VOXR_NATIVE_STATUS_CODEC_FAILURE;
    }
    if (bit_depth != 10 && bit_depth != 12 && bit_depth != 16) {
        return VOXR_NATIVE_STATUS_UNSUPPORTED;
    }
    if (!voxr_hdr_transfer_is_hdr(transfer)) {
        return VOXR_NATIVE_STATUS_UNSUPPORTED;
    }
    if ((size_t)width > SIZE_MAX / 8u) {
        return VOXR_NATIVE_STATUS_INVALID_DIMENSIONS;
    }
    if (source_stride < (size_t)width * 8u ||
        destination_stride < (size_t)width * 4u) {
        return VOXR_NATIVE_STATUS_CODEC_FAILURE;
    }
    int status = voxr_hdr_luts_ready();
    if (status != VOXR_NATIVE_STATUS_OK) return status;
    int is_hlg = transfer == VOXR_HDR_TRANSFER_HLG;
    unsigned int mask = bit_depth == 16
                      ? 0xffffu
                      : (unsigned int)((1u << bit_depth) - 1u);
    const float *linear_lut = is_hlg ? voxr_hlg_lut : voxr_pq_lut;
    const float *tone_scale_lut =
        is_hlg ? voxr_hlg_tone_scale_lut : voxr_pq_tone_scale_lut;
    for (int row = 0; row < height; row++) {
        if (row % deadline_rows == 0) {
            status = voxr_native_deadline_status(deadline_monotonic_ms);
            if (status != VOXR_NATIVE_STATUS_OK) return status;
        }
        const uint8_t *source_row = source + (size_t)row * source_stride;
        uint8_t *destination_row =
            destination + (size_t)row * destination_stride;
        for (int column = 0; column < width; column++) {
            const uint8_t *source_pixel = source_row + (size_t)column * 8u;
            uint16_t red_code =
                (uint16_t)(voxr_hdr_read_le16(source_pixel) & mask);
            uint16_t green_code =
                (uint16_t)(voxr_hdr_read_le16(source_pixel + 2) & mask);
            uint16_t blue_code =
                (uint16_t)(voxr_hdr_read_le16(source_pixel + 4) & mask);
            uint16_t red_index = voxr_hdr_lut_index(red_code, bit_depth);
            uint16_t green_index = voxr_hdr_lut_index(green_code, bit_depth);
            uint16_t blue_index = voxr_hdr_lut_index(blue_code, bit_depth);
            float red = linear_lut[red_index];
            float green = linear_lut[green_index];
            float blue = linear_lut[blue_index];
            uint16_t maximum_index = red_index;
            if (green_index > maximum_index) maximum_index = green_index;
            if (blue_index > maximum_index) maximum_index = blue_index;
            if (is_hlg) {
                float luma = voxr_hdr_linear_luma(gamut, red, green, blue);
                float ootf_scale =
                    voxr_hlg_ootf_scale_lut[voxr_unit_lut_index(luma)];
                red *= ootf_scale;
                green *= ootf_scale;
                blue *= ootf_scale;
                float maximum = fmaxf(red, fmaxf(green, blue));
                maximum_index = voxr_unit_lut_index(maximum);
            }
            float scale = tone_scale_lut[maximum_index];
            uint8_t *destination_pixel =
                destination_row + (size_t)column * 4u;
            voxr_hdr_pipeline_pixel(
                red, green, blue, scale, gamut, destination_pixel);
            unsigned int alpha =
                (unsigned int)voxr_hdr_read_le16(source_pixel + 6) & mask;
            destination_pixel[3] = (uint8_t)(
                (alpha * 255u + (mask >> 1)) / mask);
        }
    }
    return voxr_native_deadline_status(deadline_monotonic_ms);
}
