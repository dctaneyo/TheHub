import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  environment: process.env.NODE_ENV,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }
    }
    
    // Filter out PII
    if (event.user) {
      delete event.user.ip_address;
    }
    
    return event;
  },
});
