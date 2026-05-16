// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  serverExternalPackages: ['bcryptjs'],
}

export default nextConfig
