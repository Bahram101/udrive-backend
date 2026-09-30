import { NextRequest } from "next/server";
import { TelegramService } from "@/services/telegram.service";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    contact?: { phone_number: string };
  };
}

// POST /api/telegram/webhook
export async function POST(request: NextRequest) {
  const update: TelegramUpdate = await request.json();
  console.log('update',update)
  const message = update.message;

  if (!message) {
    return Response.json({ ok: true });
  }

  const chatId = String(message.chat.id);

  if (message.contact) {
    await TelegramService.handleContact(chatId, message.contact.phone_number);
  } else if (message.text === "/start") {
    await TelegramService.handleStart(chatId);
  }

  return Response.json({ ok: true });
}
