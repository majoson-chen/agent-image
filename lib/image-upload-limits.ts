/**
 * 图像上传 / image-fetch 源数量与体积上限（无 server-only，客户端与工具共用）。
 */

export const USER_ATTACH_MAX_IMAGES = 10

/** 与历史命名对齐；值同 USER_ATTACH_MAX_IMAGES */
export const IMAGE_FETCH_MAX_SOURCES = USER_ATTACH_MAX_IMAGES

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
