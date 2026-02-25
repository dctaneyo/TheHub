export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
  }
) => {
  const Sentry = await import('@sentry/nextjs');
  
  Sentry.captureException(err, {
    tags: {
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routeType: context.routeType,
    },
    extra: {
      routePath: context.routePath,
    },
  });
};
