// Sends a photo to a vision model through OpenRouter.

import { VISION } from '../config.js';
import { buildPrompt } from './prompt.js';
import { parseReply } from './parse.js';

function explain(status, detail = '') {
  const meaning =
    {
      401: 'OpenRouter rejected the key. Check it in Settings.',
      402: 'The OpenRouter key has run out of credit.',
      403: 'OpenRouter refused the request. Check the key’s limits.',
      404: 'OpenRouter doesn’t know that model. Check the model name in Settings.',
      429: 'Too many requests just now. Wait a moment, then press Read again.',
    }[status] ?? 'OpenRouter couldn’t read the photo.';
  return detail ? `${meaning} (${detail})` : meaning;
}

// `image` is a data: address. `request` is only replaced in tests.
export async function readNotes(image, settings, existingHeadings = [], request = fetch) {
  const body = {
    model: settings.model,
    max_tokens: VISION.maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image } },
          { type: 'text', text: buildPrompt({ ...settings, existingHeadings }) },
        ],
      },
    ],
  };

  let response;
  let data;
  try {
    response = await request(VISION.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(VISION.timeoutMs),
    });
    data = await response.json().catch((e) => {
      if (e.name === 'SyntaxError') return null; // an error page rather than JSON
      throw e;
    });
  } catch (e) {
    const message =
      e.name === 'TimeoutError'
        ? 'The model took too long. Press Read again.'
        : 'Couldn’t reach OpenRouter. Check the internet connection, then press Read again.';
    throw new Error(message, { cause: e });
  }

  if (!response.ok || data?.error) throw new Error(explain(data?.error?.code ?? response.status, data?.error?.message));
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('The answer was cut off. Photograph fewer notes at once.');
  return parseReply(choice?.message?.content ?? '');
}
