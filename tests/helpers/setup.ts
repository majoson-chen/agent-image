import { mock } from 'bun:test'

// server-only 在 bun test 环境中抛错，mock 为空模块
mock.module('server-only', () => ({ default: undefined }))
