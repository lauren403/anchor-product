type ScrubbableEvent = {
  breadcrumbs?: unknown;
  contexts?: unknown;
  extra?: unknown;
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: unknown }> };
  fingerprint?: unknown;
  logentry?: unknown;
  message?: string;
  request?: unknown;
  server_name?: string;
  transaction?: string;
  transaction_info?: unknown;
  user?: unknown;
  tags?: Record<string, unknown>;
  spans?: Array<{ data?: unknown; description?: string; tags?: unknown }>;
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
  delete event.fingerprint;
  delete event.logentry;
  delete event.message;
  delete event.server_name;
  delete event.tags;
  delete event.transaction_info;

  // Error messages can contain form values, selections or URLs. Retain the
  // exception class and stack frames needed for diagnosis, but never its value.
  for (const exception of event.exception?.values ?? []) {
    delete exception.value;
    if (!exception.type) {
      exception.type = "Error";
    }
  }

  // Transaction and span descriptions can contain raw URLs or dynamic values.
  // Keep timing and operation metadata, but use a stable non-identifying label.
  if (event.transaction) event.transaction = "anchor-route";

  for (const span of event.spans ?? []) {
    delete span.data;
    delete span.description;
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
