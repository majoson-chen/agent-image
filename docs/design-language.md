# agent-image 设计语言与主题（daisyUI）

本项目的 **组件与语义色** 由 **[daisyUI 5](https://daisyui.com/)** 内置主题提供；`app/globals.css` 仅使用 `@plugin "daisyui"`（**暂不** 使用 `@plugin "daisyui/theme"` 覆盖色值）。业务代码使用 **语义 utility**（`bg-base-100`、`text-base-content`、`btn-primary` 等），**禁止** `bg-green-500`、裸 `#hex` 等非语义色（见 [Colors](https://daisyui.com/docs/colors/)）。

**设计稿（Pencil 等）：** 填色请对照 **设计计划** [`docs/plans/2026-04-23-001-feat-chat-ui-shell-plan.md`](../plans/2026-04-23-001-feat-chat-ui-shell-plan.md) 中的 **「设计稿用色」** 表（与当前安装的 daisyUI 内置主题一致）。

## 日后若要品牌调色

- 在 `globals.css` 增加 `@plugin "daisyui/theme" { name: "dark"; … }` 等，**只覆盖** 需要改的 `--color-*`，其余继承同名内置主题（[Customize an existing theme](https://daisyui.com/docs/themes/#how-to-customize-an-existing-theme)）。

## 设计原则

1. **尊重内置阶梯**：层次用 `base-100` → `base-200` → `base-300` 与 `base-content`，不在稿子里自造一套灰。
2. **单一主行动色**：主按钮、关键强调用 **`primary`**（`btn-primary`）；`error` / `success` / `warning` 对齐状态语义。
3. **工具可读性**：工具名、JSON 用 **`font-mono`**；次要说明用 **`text-base-content/70`** 或 **`/50`**。

## daisyUI 语义色（与产品含义）

| daisyUI 角色                             | 用途                 |
| ---------------------------------------- | -------------------- |
| `base-100` / `200` / `300`               | 画布、侧栏、抬升与边 |
| `base-content`                           | 主正文               |
| `primary` / `primary-content`            | 主 CTA               |
| `secondary` / `accent`                   | 次要强调             |
| `neutral`                                | 低饱和 UI 块         |
| `info` / `success` / `warning` / `error` | 状态与 R16           |

## 主题切换（与当前 `globals.css` 一致）

- **默认**：内置 **`light`**（`light --default`）。
- **系统深色**：`prefers-color-scheme: dark` 时使用内置 **`dark`**（`dark --prefersdark`）。
- **强制某一主题**：根节点 `data-theme="light"` 或 `data-theme="dark"`（见 [themes](https://daisyui.com/docs/themes/)）。

## 字体

- **Sans / Mono**：`app/layout.tsx` 的 `next/font` 注入 `--font-app-*`；`globals.css` 的 `@theme` 映射 `font-sans` / `font-mono`。

## 审查清单

- [ ] 是否避免了 `bg-*-500` 与散落 hex？
- [ ] 状态色是否用了 `success` / `error` 等语义名？
- [ ] 交互是否有可见 focus（如 `ring-primary`）？

## 参考链接

- [Install](https://daisyui.com/docs/install/) · [Config](https://daisyui.com/docs/config/) · [Colors](https://daisyui.com/docs/colors/) · [Themes](https://daisyui.com/docs/themes/)
