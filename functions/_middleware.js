// Redirect ONLY the exact production pages.dev hostname to the custom domain.
// Preview deployments (<hash>.bullheads.pages.dev, main.bullheads.pages.dev)
// have different hostnames and pass through untouched. No loop is possible
// because the custom domain never matches this check.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'bullheads.pages.dev') {
    url.protocol = 'https:';
    url.host = 'bullheadhotels.co.ke';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
