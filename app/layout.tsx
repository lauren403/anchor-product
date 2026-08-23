import type { Metadata, Viewport } from "next";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anchor · support for the ADHD day you are actually having",
  description:
    "A private, low-shame ADHD wellbeing tool developed by Body Belonging Clinic.",
  applicationName: "Anchor",
  // External beta is blocked pending clinical, APD, privacy, First Nations governance,
  // lived-experience/accessibility, intended-purpose and independent security review.
  // Keep Anchor out of search results until those gates are cleared.
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  other: { "codex-preview": "development" },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#2e1a22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        {children}
      </body>
    </html>
  );
}
