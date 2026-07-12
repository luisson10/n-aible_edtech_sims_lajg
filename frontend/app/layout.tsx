import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import RoleBasedRedirect from "@/components/RoleBasedRedirect"
import DraggableFeedback from "@/components/DraggableFeedback"
import { SonnerToaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

const clashGrotesk = localFont({
  src: "../public/fonts/ClashGrotesk-Variable.woff2",
  display: "swap",
  variable: "--font-clash-grotesk",
  weight: "200 700",
  fallback: ["Arial", "sans-serif"],
})

export const metadata: Metadata = {
  title: "n-gage by n-aible",
  description: "Case Study Simulation Platform by n-aible",
  icons: {
    icon: '/n-aiblelogo.png',
    shortcut: '/n-aiblelogo.png',
    apple: '/n-aiblelogo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={clashGrotesk.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <RoleBasedRedirect>
              {children}
            </RoleBasedRedirect>
            <DraggableFeedback />
          </AuthProvider>
          <SonnerToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
