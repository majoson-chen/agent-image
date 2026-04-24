# agent-image

单机自用的 **对话式图像 Agent** 玩具项目：Next.js +（规划中的）Vercel AI SDK，多厂商 **LLM / 生图 Provider**，工具与中间步骤在对话中可见。

## 需求说明

- [产品需求（Compound Engineering）](docs/brainstorms/2026-04-23-agent-image-requirements.md)

## 前置条件

- [Bun](https://bun.sh)
- Node 兼容由 Next 版本决定（本地开发以 Bun 调用脚本为主）

## 开发

```bash
bun install
# 配置 DATABASE_URL 可选；默认使用仓库根目录下 file:./data.db（见 prisma.config.ts）
bun --bun run prisma migrate dev
bun dev
```

常用脚本见 `package.json`：`dev`、`build`、`lint`、`lint:fix`。

## 技术栈

- **Next.js**（App Router）、**React**、**TypeScript**
- **Prisma** + **SQLite**（`@prisma/adapter-better-sqlite3`），生成客户端在 `generated/prisma/`
- **Tailwind CSS** v4

## Compound Engineering

- **Agent 指引：** [AGENTS.md](AGENTS.md)
- **本机 CE 偏好：** 复制或编辑 `.compound-engineering/config.local.yaml`（已 gitignore）；模板见 `config.local.example.yaml`。
- **环境检查：** 仓库未内置 `scripts/check-health` 时，可从本机安装的 Compound Engineering 插件目录运行检查脚本，例如：

    ```bash
    bash /path/to/compound-engineering/skills/ce-setup/scripts/check-health
    ```

    在 Cursor 中也可使用 `/ce-setup` 由助手代为执行。

## 许可证

私有项目（`package.json` 中 `"private": true`）。
