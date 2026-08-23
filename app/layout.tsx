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
  // Anchor is not publicly deployed. The only running instance is a password-gated
  // beta rehearsal on a workers.dev URL; there has never been a governed production
  // deploy. Until there is one, and until the release owner decides to launch
  // publicly, Anchor must not appear in search results.
  //
  // This replaces an earlier note saying the external beta was "blocked pending
  // clinical, APD, privacy, First Nations governance, lived-experience/accessibility,
  // intended-purpose and independent security review". Those reviews are complete:
  // release record anchor-v7-beta-2026-08-23 records all six governance domains as
  // approved and passes `npm run validate:release -- --require-approved`. The comment
  // was left stale and contradicted the record, which is exactly the kind of
  // disagreement that makes a reader distrust both.
  //
  // The DIRECTIVE below is unchanged and deliberate: governance being complete is not
  // the same as being live. Keep it until production go-live is an explicit decision.
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
