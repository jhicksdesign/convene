export function renderVerifyEmail({ url }: { url: string }) {
  const subject = "Verify your Eventide email";
  const text = `Confirm this email for your Eventide account:\n\n${url}\n\nThe link expires in 24 hours.`;
  const html = `
<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Confirm this email</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px">Tap the button to link this address to your Eventide account.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">Confirm email</a></p>
  <p style="font-size:13px;color:#666;margin:0">Or paste this URL into your browser:<br><span style="word-break:break-all">${url}</span></p>
</body></html>`;
  return { subject, html, text };
}
