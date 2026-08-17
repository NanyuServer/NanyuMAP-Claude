// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
  // 启用响应压缩（gzip），减小传输体积
  compress: true,
  async headers() {
    return [
      {
        // 静态资源（地图图片等）长缓存；配合 URL 版本号（?v=4）可安全更新
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // 构建产物默认已带 hash 指纹，可长缓存
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
