import * as Sentry from "@sentry/nextjs";
import { privacySafeSentryOptions } from "@/lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  ...privacySafeSentryOptions(),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
