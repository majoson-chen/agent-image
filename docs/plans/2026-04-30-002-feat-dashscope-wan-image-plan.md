# 2026-04-30-002 — 百炼 DashScope 万相图像（仅同步 HTTP，不含视频）

## 目标

- 接入阿里云百炼 **万相 2.7 图像** 文生图 / 图生图（参考图）的 **HTTP 同步调用**，与现有 Seedream 并列，**不接视频**、不接 `@ai-sdk/alibaba` 的 `video()` / 异步任务链。
- 文档依据：[万相-图像生成与编辑 API](https://help.aliyun.com/zh/model-studio/wan-image-generation-and-editing-api-reference) — `POST …/api/v1/services/aigc/multimodal-generation/generation`，`Authorization: Bearer`，请求体 `model` + `input.messages` + `parameters`；响应 `output.choices[].message.content[].image` URL。

## 范围

| 做                                                                 | 不做                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `ProviderType` 增 `DASHSCOPE_WAN_IMAGE`                            | Wan 文生视频 / 同步外 Async Task                       |
| `imageModelInputSchema` 按 `providerType` 分支（万相参考图上限 9） | `color_palette`、`bbox_list`、组图 `enable_sequential` |
| `lib/image/wan-image-presets.ts` + 设置表单厂商选择                | 改 R15 确认粒度                                        |
| `executeImageGeneration` 分发 + 解析 DashScope JSON                | 再走 Seedream 的 LAS body 形态                         |

## 实现要点

1. **迁移**：Prisma `ProviderType` 追加枚举值；`bun --bun prisma migrate dev`。
2. **校验**：`z.discriminatedUnion('providerType', …)`；万相 `maxReferenceImages` ≤ 9。
3. **默认 Base URL**：北京 `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`；可选填新加坡 / `image-generation` 等完整 URL（与 Seedream 心智一致）。
4. **分辨率**：对话 `size` 为 `WxH` 时转为百炼方式二的 `W*H`；正方形 1024/2048/4096 可映射 `1K`/`2K`/`4K`（`wan2.7-image` 无 4K、`有参考图时 4K→2K` 按文档约束）。
5. **测试**：扩展 `image-model-schema.test`、`image-provider-factory.test`（Mock `output.choices`）；Vitest 用 Node（`./node_modules/.bin/vitest run`）。

## 验收

- 创建万相生图模型 → DB 落库；工厂对 `DASHSCOPE_WAN_IMAGE` 发正确 JSON 并落盘首图 URL。
- 现有 Seedream 路径行为不变。

execution_note: test-first for schema + factory; then form wiring.
