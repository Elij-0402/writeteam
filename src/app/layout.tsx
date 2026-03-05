import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AIConfigProvider } from "@/components/providers/ai-config-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://writeteam.app"

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "WriteTeam - AI 写作助手",
    template: "%s | WriteTeam",
  },
  description: "面向小说作者的 AI 创意写作助手，支持续写、改写、头脑风暴与故事世界构建。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "WriteTeam - AI 写作助手",
    description: "面向小说作者的 AI 创意写作助手，支持续写、改写、头脑风暴与故事世界构建。",
    url: appUrl,
    siteName: "WriteTeam",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WriteTeam - AI 写作助手",
    description: "面向小说作者的 AI 创意写作助手，支持续写、改写、头脑风暴与故事世界构建。",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AIConfigProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </AIConfigProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
