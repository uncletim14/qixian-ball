import './globals.css';
import LiffAutoLogin from './LiffAutoLogin';

// 🆕 貼到 LINE / FB 等的網址預覽卡片（圖片放在 public/og.jpg）
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://qixian-ball-yub6.vercel.app';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: '七賢匹克周末球敘團',
  description: '匹克球報名｜南高雄七賢國小',
  openGraph: {
    title: '七賢匹克球敘團｜報名',
    description: '匹克球報名｜南高雄七賢國小',
    url: '/',
    siteName: '七賢匹克球敘團',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: '七賢匹克球敘團' }],
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '七賢匹克球敘團｜報名',
    description: '匹克球報名｜南高雄七賢國小',
    images: ['/og.jpg'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body className="bg-[#122037] text-white antialiased min-h-screen">
        <LiffAutoLogin />
        {children}
      </body>
    </html>
  );
}
