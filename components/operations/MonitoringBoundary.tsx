"use client";

import * as Sentry from "@sentry/browser";
import { useEffect, type ReactNode } from "react";

const environment = process.env.NEXT_PUBLIC_ANCHOR_ENV ?? "local";
const release = process.env.NEXT_PUBLIC_RELEASE_SHA ?? "development";
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let monitoringStarted = false;

type ScrubbableEvent = {
  request?: { url?: string };
  user?: unknown;
  breadcrumbs?: unknown;
  contexts?: unknown;
  extra?: unknown;
};

function removeSensitiveContext<T extends ScrubbableEvent>(event: T): T {
  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      url.search = "";
      url.hash = "";
      event.request.url = url.toString();
    } catch {
      delete event.request.url;
    }
  }

  delete event.user;
  delete event.breadcrumbs;
  delete event.contexts;
  delete event.extra;
  return event;
}

function startMonitoring(): void {
  if (monitoringStarted || !dsn) return;

  Sentry.init({
    dsn,
    environment,
    release: `anchor@${release}`,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: environment === "production" ? 0.05 : 0.2,
    beforeSend: (event) => removeSensitiveContext(event),
    beforeSendTransaction: (event) => removeSensitiveContext(event),
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
  monitoringStarted = true;
}

export function MonitoringBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    startMonitoring();
  }, []);

  return children;
}
