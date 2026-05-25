import OpenAI from 'openai';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canUseManagerFeature, HttpsError } from '../lib/firebase.js';
import { RESERVED_WIDGET_KEYS } from '../lib/jobDefaults.js';

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const AI_JOB_DRAFT_MODEL = 'gpt-5.5';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDraft(raw = {}) {
  const allowedWidgets = new Set(['company', ...RESERVED_WIDGET_KEYS]);
  const widgetKeys = Array.isArray(raw.widgetKeys)
    ? raw.widgetKeys.map((key) => cleanText(key, 80)).filter((key) => allowedWidgets.has(key))
    : [];
  return {
    title: cleanText(raw.title, 240) || 'Untitled Job',
    type: cleanText(raw.type, 120) || 'general',
    description: cleanText(raw.description, 5000),
    priority: ['low', 'normal', 'high', 'urgent'].includes(raw.priority) ? raw.priority : 'normal',
    company: {
      name: cleanText(raw.company?.name, 240),
      legalName: cleanText(raw.company?.legalName, 240),
      type: cleanText(raw.company?.type, 120),
      email: cleanText(raw.company?.email, 320).toLowerCase(),
      phone: cleanText(raw.company?.phone, 80),
      website: cleanText(raw.company?.website, 240),
      address: cleanText(raw.company?.address, 1000),
      notes: cleanText(raw.company?.notes, 5000),
      status: cleanText(raw.company?.status, 80) || 'draft',
    },
    widgetKeys: [...new Set(['company', ...widgetKeys])],
  };
}

const jobDraftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'type', 'description', 'priority', 'company', 'widgetKeys'],
  properties: {
    title: { type: 'string' },
    type: { type: 'string' },
    description: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
    company: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'legalName', 'type', 'email', 'phone', 'website', 'address', 'notes', 'status'],
      properties: {
        name: { type: 'string' },
        legalName: { type: 'string' },
        type: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        website: { type: 'string' },
        address: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string' },
      },
    },
    widgetKeys: {
      type: 'array',
      items: { type: 'string', enum: ['company', ...RESERVED_WIDGET_KEYS] },
    },
  },
};

export const draftJobWithAi = onCall({
  region: 'us-central1',
  secrets: [OPENAI_API_KEY],
}, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const prompt = cleanText(request.data?.prompt, 8000);

  if (!showId || !prompt) {
    throw new HttpsError('invalid-argument', 'showId and prompt are required.');
  }

  const allowed = await canUseManagerFeature(callerUid, showId, 'jobs');
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'OPENAI_API_KEY is not configured.');

  const client = new OpenAI({ apiKey });
  const showContext = cleanText(request.data?.showContext, 2000);
  const response = await client.responses.create({
    model: AI_JOB_DRAFT_MODEL,
    input: [
      {
        role: 'system',
        content: [
          'You draft operational show jobs for managers.',
          'Return only the structured job draft.',
          'Focus on job basics and company details.',
          'Do not create request widgets.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Show context: ${showContext || 'No extra context'}\n\nManager prompt: ${prompt}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'showmaster_job_draft',
        strict: true,
        schema: jobDraftSchema,
      },
    },
  });

  const outputText = response.output_text || response.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
  if (!outputText) {
    throw new HttpsError('internal', 'AI did not return a draft.');
  }

  try {
    return { ok: true, draft: normalizeDraft(JSON.parse(outputText)) };
  } catch (err) {
    throw new HttpsError('internal', 'AI returned an unreadable draft.');
  }
});
