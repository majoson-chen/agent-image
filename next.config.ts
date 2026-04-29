import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    serverExternalPackages: ['prisma-adapter-bun-sqlite'],
}

export default nextConfig
