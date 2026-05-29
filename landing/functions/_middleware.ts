/**
 * Scientific alias redirect (Phase 4): kilocalorie-index.thebay.ma → khobz-index.thebay.ma
 * Preserves path and query string. Runs before static asset / SPA routing.
 */

const CANONICAL_HOST = 'khobz-index.thebay.ma';
const ALIAS_HOST = 'kilocalorie-index.thebay.ma';

type PagesContext = {
  request: Request;
  next: () => Promise<Response>;
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  if (url.hostname === ALIAS_HOST) {
    url.hostname = CANONICAL_HOST;
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
};
