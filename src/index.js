import 'dotenv/config';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import { getAIResponse } from './claude.js';
import { saveMessage, getHistory, getAllBookings } from './db.js';

const business = JSON.parse(fs.readFileSync('./config/business.json', 'utf-8'));

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ownerChatId = process.env.OWNER_CHAT_ID;

bot.start((ctx) => {
  const greeting =
    business.language === 'kk'
      ? `Сәлеметсіз бе! Мен "${business.businessName}" виртуалды көмекшісімін. Қызметтеріміз туралы сұрай аласыз немесе жазылуға өтінім қалдыра аласыз.`
      : `Здравствуйте! Я виртуальный помощник "${business.businessName}". Спросите про услуги и цены или запишитесь на удобное время.`;
  ctx.reply(greeting);
});

bot.command('bookings', (ctx) => {
  if (ownerChatId && String(ctx.chat.id) !== String(ownerChatId)) {
    return ctx.reply('Эта команда доступна только владельцу бизнеса.');
  }
  const bookings = getAllBookings();
  if (bookings.length === 0) {
    return ctx.reply('Записей пока нет.');
  }
  const lines = bookings.slice(0, 20).map((b) =>
    `#${b.id} | ${b.preferred_datetime} | ${b.service} | ${b.customer_name} | ${b.customer_phone} | ${b.status}`
  );
  ctx.reply(`📋 Последние записи:\n\n${lines.join('\n')}`);
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  try {
    await ctx.sendChatAction('typing');

    const history = getHistory(chatId);
    const { text, bookingCreated } = await getAIResponse(chatId, userMessage, history, business);

    saveMessage(chatId, 'user', userMessage);
    if (text) saveMessage(chatId, 'assistant', text);

    if (text) {
      await ctx.reply(text);
    }

    if (bookingCreated && ownerChatId) {
      const summary =
        `🆕 Новая запись #${bookingCreated.id}\n` +
        `Имя: ${bookingCreated.customerName}\n` +
        `Телефон: ${bookingCreated.customerPhone}\n` +
        `Услуга: ${bookingCreated.service}\n` +
        `Дата/время: ${bookingCreated.preferredDatetime}\n` +
        (bookingCreated.notes ? `Заметки: ${bookingCreated.notes}` : '');
      await bot.telegram.sendMessage(ownerChatId, summary);
    }
  } catch (err) {
    console.error('Error handling message:', err);
    await ctx.reply('Извините, произошла ошибка. Попробуйте ещё раз чуть позже.');
  }
});

bot.launch();
console.log(`Bot for "${business.businessName}" is running...`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
