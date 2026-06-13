import { saveBooking } from './db.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// Tool definition: lets the model create a booking when it has enough info
const tools = [
  {
    name: 'create_booking',
    description:
      'Create a new booking/appointment record once the customer has confirmed the service, preferred date/time, their name and phone number. Call this only when you have all the required details.',
    input_schema: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: 'Customer full name' },
        customerPhone: { type: 'string', description: 'Customer phone number' },
        service: { type: 'string', description: 'Name of the service being booked' },
        preferredDatetime: {
          type: 'string',
          description: 'Preferred date and time as stated by the customer (free text, e.g. "tomorrow at 15:00")'
        },
        notes: { type: 'string', description: 'Any additional notes from the customer' }
      },
      required: ['customerName', 'customerPhone', 'service', 'preferredDatetime']
    }
  }
];

function buildSystemPrompt(business) {
  const servicesList = business.services
    .map((s) => `- ${s.name}: ${s.price} тг (${s.durationMin} мин)`)
    .join('\n');

  return `Ты — виртуальный ассистент бизнеса "${business.businessName}".

Описание бизнеса: ${business.description}
Часы работы: ${business.workingHours}
Адрес: ${business.address}

Доступные услуги и цены:
${servicesList}

Твоя задача:
1. Отвечать клиентам на их вопросы об услугах, ценах, графике работы.
2. Помогать клиенту выбрать услугу и удобное время.
3. Когда клиент готов записаться и ты собрал его имя, телефон, выбранную услугу и желаемую дату/время — вызови инструмент create_booking.
4. Будь дружелюбным, кратким и профессиональным. Пиши на языке, на котором пишет клиент.

Дополнительные инструкции: ${business.extraInstructions || 'нет'}`;
}

export async function getAIResponse(chatId, userMessage, history, business) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let response = await callClaude(apiKey, business, messages);
  let finalText = '';
  let bookingCreated = null;

  // Loop in case the model wants to call the tool
  for (let i = 0; i < 3; i++) {
    const textBlocks = response.content.filter((b) => b.type === 'text');
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

    finalText += textBlocks.map((b) => b.text).join('\n');

    if (toolUseBlocks.length === 0) break;

    // Handle tool calls
    const toolResults = [];
    for (const tool of toolUseBlocks) {
      if (tool.name === 'create_booking') {
        const id = saveBooking(chatId, tool.input);
        bookingCreated = { id, ...tool.input };
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: `Booking #${id} created successfully.`
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await callClaude(apiKey, business, messages);
  }

  return { text: finalText.trim(), bookingCreated };
}

async function callClaude(apiKey, business, messages) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(business),
      tools,
      messages
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${errText}`);
  }

  return res.json();
}
