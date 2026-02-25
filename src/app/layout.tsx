import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "next-themes";
import { ApolloProvider } from "@/lib/apollo-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "The Hub",
  description: "All-in-one franchise management dashboard",
  manifest: "/manifest.json",
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dc2626' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ARL Hub",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-title" content="ARL Hub" />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        {/* Block iOS Safari page-level pinch-to-zoom (Safari ignores viewport user-scalable=no).
            Elements with touch-action:none (like ZoomableVideo) handle their own zoom. */}
        <script dangerouslySetInnerHTML={{ __html: `
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="hub-theme"
        >
          <ApolloProvider>
            <AuthProvider>
              <SocketProvider>
                {children}
              </SocketProvider>
            </AuthProvider>
          </ApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
