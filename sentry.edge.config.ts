import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  environment: process.env.NODE_ENV,
  
  tracesSampleRate: 0.1,
  
  beforeSend(event, hint) {
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }
    }
    
    if (event.user) {
      delete event.user.ip_address;
    }
    
    return event;
  },
});
