import './globals.css';

export const metadata = {
  title: '七賢匹克周末球敘團',
  description: '南高雄七賢國小匹克球交流團',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body className="bg-[#122037] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
