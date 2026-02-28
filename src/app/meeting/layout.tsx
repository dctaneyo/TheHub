import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Hub – Join Meeting",
  description: "Join a Hub video meeting",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
    ],
  },
};

export default function MeetingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
