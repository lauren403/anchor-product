"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body>
        <main>
          <h1>Anchor needs a moment</h1>
          <p>Please refresh the page. If this continues, close Anchor and try again later.</p>
        </main>
      </body>
    </html>
  );
}
