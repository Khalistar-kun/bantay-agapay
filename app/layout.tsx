import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Bantay-Agapay - AFGBMTS Visitor Monitoring",
  description: "Digital visitor registration and monitoring system for AFGBMTS",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  )
}
