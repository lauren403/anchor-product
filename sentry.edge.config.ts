import * as Sentry from "@sentry/nextjs";
import { privacySafeSentryOptions } from "@/lib/sentry-privacy";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  ...privacySafeSentryOptions(),
});
