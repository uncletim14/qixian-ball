/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 強制忽略 TypeScript 編譯檢查
    ignoreBuildErrors: true,
  },
  eslint: {
    // 強制忽略 ESLint 代碼風格檢查
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
