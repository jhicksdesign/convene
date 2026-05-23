// Plain-string template — no react-email runtime needed for a single CTA.
export function renderMagicLinkEmail({ url }: { url: string }) {
  const subject = "Your Eventide sign-in link";
  const text = `Sign in to Eventide by opening this link (valid 15 minutes):\n\n${url}\n\nIf you didn't request this, you can ignore the email.`;
  const html = `
<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Sign in to Eventide</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px">Tap the button below to finish signing in. The link is good for 15 minutes.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">Open Eventide</a></p>
  <p style="font-size:13px;color:#666;margin:0">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all">${url}</span></p>
</body></html>`;
  return { subject, html, text };
}
