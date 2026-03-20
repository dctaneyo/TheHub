import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/error-boundary";
import { CsrfInit } from "@/components/csrf-init";
import { LayoutProvider } from "@/lib/layout-context";
import { TenantProvider } from "@/lib/tenant-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dc2626' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: "The Hub",
  description: "All-in-one franchise management dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Hub",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="The Hub" />
        <meta name="csp-nonce" content={nonce} />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        {/* Block iOS Safari page-level pinch-to-zoom (Safari ignores viewport user-scalable=no).
            Elements with touch-action:none (like ZoomableVideo) handle their own zoom. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('touchmove', function(e) {
            if (e.touches.length > 1) {
              e.preventDefault();
            }
          }, { passive: false });
          document.addEventListener('gesturestart', function(e) {
            e.preventDefault();
          }, { passive: false });
          document.addEventListener('gesturechange', function(e) {
            e.preventDefault();
          }, { passive: false });
          document.addEventListener('gestureend', function(e) {
            e.preventDefault();
          }, { passive: false });
        `}} />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-[var(--hub-red)] focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg">Skip to main content</a>
        <CsrfInit />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="hub-theme"
        >
          <AuthProvider>
            <SocketProvider>
              <TenantProvider>
                <LayoutProvider>
                  <ErrorBoundary>
                    <main id="main-content">
                      {children}
                    </main>
                  </ErrorBoundary>
                </LayoutProvider>
              </TenantProvider>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
