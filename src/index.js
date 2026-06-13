import 'dotenv/config';
import { Telegraf } from 'telegraf';
import fs from 'fs';

import { getAIResponse } from './claude.js';

import {
saveMessage,
getHistory,
getAllBookings,
updateBookingStatus,
getBookingById
} from './db.js';

const business = JSON.parse(
fs.readFileSync('./config/business.json', 'utf-8')
);

const bot = new Telegraf(
process.env.TELEGRAM_BOT_TOKEN
);

const ownerChatId =
process.env.OWNER_CHAT_ID;

const statusEmoji = {
new: '🆕',
confirmed: '✅',
completed: '🎉',
cancelled: '❌'
};

bot.start((ctx) => {
const greeting =
business.language === 'kk'
? `Сәлеметсіз бе! Мен "${business.businessName}" виртуалды көмекшісімін. Қызметтеріміз туралы сұрай аласыз немесе жазылуға өтінім қалдыра аласыз.`
: `Здравствуйте! Я виртуальный помощник "${business.businessName}". Спросите про услуги и цены или запишитесь на удобное время.`;

ctx.reply(greeting);
});

bot.command('bookings', (ctx) => {
if (
ownerChatId &&
String(ctx.chat.id) !== String(ownerChatId)
) {
return ctx.reply(
'Эта команда доступна только владельцу бизнеса.'
);
}

const bookings = getAllBookings();

if (bookings.length === 0) {
return ctx.reply('Записей пока нет.');
}

const lines = bookings
.slice(0, 20)
.map(
(b) =>
`${statusEmoji[b.status] || ''} #${b.id}\n` +
`📅 ${b.preferred_datetime}\n` +
`💇 ${b.service}\n` +
`👤 ${b.customer_name}\n` +
`📞 ${b.customer_phone}\n` +
`📌 ${b.status}`
);

ctx.reply(
`📋 Последние записи:\n\n${lines.join('\n\n')}`
);
});

bot.command('confirm', (ctx) => {
if (
ownerChatId &&
String(ctx.chat.id) !== String(ownerChatId)
) {
return ctx.reply(
'Команда тек иесіне қолжетімді.'
);
}

const bookingId = Number(
ctx.message.text.split(' ')[1]
);

if (!bookingId) {
return ctx.reply(
'Мысалы: /confirm 1'
);
}

const booking =
getBookingById(bookingId);

if (!booking) {
return ctx.reply(
'Жазылу табылмады.'
);
}

updateBookingStatus(
bookingId,
'confirmed'
);

ctx.reply(
`✅ Жазылу #${bookingId} расталды`
);
});

bot.command('cancel', (ctx) => {
if (
ownerChatId &&
String(ctx.chat.id) !== String(ownerChatId)
) {
return ctx.reply(
'Команда тек иесіне қолжетімді.'
);
}

const bookingId = Number(
ctx.message.text.split(' ')[1]
);

if (!bookingId) {
return ctx.reply(
'Мысалы: /cancel 1'
);
}

const booking =
getBookingById(bookingId);

if (!booking) {
return ctx.reply(
'Жазылу табылмады.'
);
}

updateBookingStatus(
bookingId,
'cancelled'
);

ctx.reply(
`❌ Жазылу #${bookingId} тоқтатылды`
);
});

bot.command('done', (ctx) => {
if (
ownerChatId &&
String(ctx.chat.id) !== String(ownerChatId)
) {
return ctx.reply(
'Команда тек иесіне қолжетімді.'
);
}

const bookingId = Number(
ctx.message.text.split(' ')[1]
);

if (!bookingId) {
return ctx.reply(
'Мысалы: /done 1'
);
}

const booking =
getBookingById(bookingId);

if (!booking) {
return ctx.reply(
'Жазылу табылмады.'
);
}

updateBookingStatus(
bookingId,
'completed'
);

ctx.reply(
`🎉 Жазылу #${bookingId} аяқталды`
);
});

bot.on('text', async (ctx) => {
const chatId = ctx.chat.id;
const userMessage =
ctx.message.text;

try {
await ctx.sendChatAction(
'typing'
);

```
const history =
  getHistory(chatId);

const {
  text,
  bookingCreated
} = await getAIResponse(
  chatId,
  userMessage,
  history,
  business
);

saveMessage(
  chatId,
  'user',
  userMessage
);

if (text) {
  saveMessage(
    chatId,
    'assistant',
    text
  );
}

if (text) {
  await ctx.reply(text);
}

if (
  bookingCreated &&
  ownerChatId
) {
  const summary =
```

`🆕 Новая запись #${bookingCreated.id}

Имя: ${bookingCreated.customerName}
Телефон: ${bookingCreated.customerPhone}
Услуга: ${bookingCreated.service}
Дата/время: ${bookingCreated.preferredDatetime}

Подтвердить:
/confirm ${bookingCreated.id}

Отменить:
/cancel ${bookingCreated.id}`;

```
  await bot.telegram.sendMessage(
    ownerChatId,
    summary
  );
}
```

} catch (err) {
console.error(
'Error handling message:',
err
);

```
await ctx.reply(
  'Извините, произошла ошибка. Попробуйте ещё раз чуть позже.'
);
```

}
});

bot.launch();

console.log(
`Bot for "${business.businessName}" is running...`
);

process.once('SIGINT', () =>
bot.stop('SIGINT')
);

process.once('SIGTERM', () =>
bot.stop('SIGTERM')
);
