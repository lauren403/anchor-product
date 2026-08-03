const prohibitedKeys = /^(?:moment|barrier|capacity|outcome|localStorage|sessionStorage|email|name|user|identity)$/i;

type ScrubbableEvent = {
  breadcrumbs?: unknown;
  contexts?: unknown;
  extra?: unknown;
  request?: unknown;
  user?: unknown;
  tags?: Record<string, unknown>;
  spans?: Array<{ data?: unknown; tags?: unknown }>;
};

/**
 * Preserve stack traces and route-level timing while removing request, identity,
 * free-text and local wellbeing-selection data before an event leaves a runtime.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.contexts;
  delete event.extra;

  if (event.tags) {
    for (const key of Object.keys(event.tags)) {
      if (prohibitedKeys.test(key)) delete event.tags[key];
    }
  }

  for (const span of event.spans ?? []) {
    delete span.data;
    delete span.tags;
  }

  return event;
}

export function privacySafeSentryOptions() {
  const environment = process.env.NEXT_PUBLIC_ANCHOR_ENV ?? process.env.ANCHOR_ENV ?? "local";
  const release = process.env.NEXT_PUBLIC_RELEASE_SHA ?? process.env.RELEASE_SHA ?? "development";

  return {
    environment,
    release: `anchor@${release}`,
    sendDefaultPii: false,
    enableLogs: false,
    tracesSampleRate: environment === "production" ? 0.05 : 0.1,
    beforeBreadcrumb: () => null,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  };
}
