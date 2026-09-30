const { config } = require("dotenv");
config();

const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set in .env");
    process.exit(1);
  }

  let tunnels;
  try {
    const res = await fetch(NGROK_API);
    ({ tunnels } = await res.json());
  } catch {
    console.error(
      "Не удалось достучаться до ngrok (http://127.0.0.1:4040). Сначала запустите: ngrok http 3000",
    );
    process.exit(1);
  }

  const tunnel = tunnels.find((t) => t.proto === "https");
  if (!tunnel) {
    console.error("Активный https-туннель ngrok не найден.");
    process.exit(1);
  }

  const webhookUrl = `${tunnel.public_url}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`,
  );
  const result = await res.json();

  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(result);
}

main();
