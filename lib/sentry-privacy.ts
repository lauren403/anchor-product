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
  user?: { ip_address?: string } | unknown;
  tags?: Record<string, unknown>;
  spans?: Array<{ data?: unknown; description?: string; tags?: unknown }>;
};

/**
 * Preserve stack traces and route-level timing while removing request, identity,
 * free-text and local wellbeing-selection data before an event leaves a runtime.
 */
/**
 * The unspecified IPv4 address. Not routable, not assigned to anyone, not in any
 * geolocation database.
 */
export const NON_GEOLOCATABLE_IP = "0.0.0.0";

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  // WHY THIS SETS A PLACEHOLDER INSTEAD OF DELETING event.user
  // ----------------------------------------------------------
  // This line used to be `delete event.user`, and it was not enough. Sending NO user
  // object does not mean Sentry stores no location: Relay derives geo during ingestion
  // from whatever IP delivered the envelope, downstream of this hook and downstream of
  // Advanced Data Scrubbing. Acceptance runs #24 through #30 all came back carrying
  // { country_code, region }, and run #27 came back carrying a CITY.
  //
  // Two things were tried before this and neither worked:
  //   - An Advanced Data Scrubbing rule on $user.geo. Inert; geo is attached after the
  //     scrubbers run.
  //   - Additional Sensitive Fields (ip_address, city, subdivision, region, country_code,
  //     geo), which Sentry's own help centre names as the way to disable IP geolocation.
  //     Run #28 came back still carrying country_code and region - both explicitly on that
  //     list - which is how we know that mechanism does not reach user.geo at all.
  //
  // So instead of leaving the field for ingestion to fill in, this fills it in first with
  // an address that cannot resolve to a place. The org already has "Prevent Storing of IP
  // Addresses" on, so the stored ip_address should remain null either way; this exists to
  // deny the GEO lookup its input, which that toggle does not do.
  //
  // This REPLACES the user object wholesale, so it is still an identity scrub: anything an
  // application put on the scope - the acceptance route deliberately sets an id and an
  // email - is gone. scripts/verify-sentry-acceptance.mjs asserts that separately, and
  // knows about this one permitted value.
  //
  // For Body Belonging Clinic this is not housekeeping. Anchor's users are neurodivergent,
  // LGBTQIA+ and Aboriginal people, and "which suburb they were in when the app crashed"
  // is not something this clinic should be able to look up, however incidentally.
  event.user = { ip_address: NON_GEOLOCATABLE_IP };

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
