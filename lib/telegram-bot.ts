// Outbound Telegram bot DMs. The chat ID is the Telegram user ID, which Auth.js
// already stores as Account.providerAccountId after a successful Telegram login
// (provided the user granted the telegram:bot_access scope).
//
// This is best-effort: a failure here never throws back to the caller. We log
// and move on so notification dispatch stays robust.

const BOT_API = "https://api.telegram.org";

export async function sendBotMessage(chatId: string, text: string, link?: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN not set — skipping DM");
    return false;
  }
  const body = link ? `${text}\n\n${link}` : text;
  try {
    const res = await fetch(`${BOT_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[telegram-bot] sendMessage non-2xx", res.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram-bot] sendMessage threw", err);
    return false;
  }
}
