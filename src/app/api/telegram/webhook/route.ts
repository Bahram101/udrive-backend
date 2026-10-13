import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { TelegramService } from "@/services/telegram.service";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
}

// Telegram sends the secret passed to setWebhook in this header on every update.
function isFromTelegram(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured");
    return false;
  }

  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/telegram/webhook
export async function POST(request: NextRequest) {
  if (!isFromTelegram(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: TelegramUpdate = await request.json();
  const message = update.message;

  if (!message) {
    return Response.json({ ok: true });
  }

  const chatId = String(message.chat.id);

  if (message.contact) {
    // Only the user's own contact (shared via the button) may be linked, not a forwarded one.
    if (!message.from || message.contact.user_id !== message.from.id) {
      await TelegramService.sendMessage(
        chatId,
        "Поделитесь своим номером кнопкой «📱 Поделиться номером».",
      );
      return Response.json({ ok: true });
    }
    await TelegramService.handleContact(chatId, message.contact.phone_number);
  } else if (message.text === "/start") {
    await TelegramService.handleStart(chatId);
  }

  return Response.json({ ok: true });
}
