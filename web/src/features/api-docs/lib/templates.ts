/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ModelDocParam } from '../types'

/**
 * Built-in documentation templates, one per relay endpoint type.
 *
 * Descriptions, titles and notes are English i18n keys; they are translated
 * when the doc is rendered. Templates only describe the gateway's own
 * contract. Model-specific limits (prompt length, reference counts, allowed
 * durations) come from the administrator's supplements.
 */

export type DocCategory =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'embedding'
  | 'other'

export type DocAuthStyle = 'bearer' | 'x-api-key' | 'query-key'

export type DocFollowUp = {
  method: 'GET' | 'POST'
  path: string
  summaryKey: string
  binary?: boolean
  response?: (modelName: string) => unknown
}

export type EndpointTemplate = {
  titleKey: string
  auth: DocAuthStyle
  params: ModelDocParam[]
  request: (modelName: string) => Record<string, unknown>
  response: (modelName: string) => unknown
  notes: string[]
  followUps: DocFollowUp[]
}

const modelParam: ModelDocParam = {
  name: 'model',
  type: 'string',
  required: true,
  description: 'Model name; use this model',
}

const streamParam: ModelDocParam = {
  name: 'stream',
  type: 'boolean',
  required: false,
  description: 'Return the result incrementally as server-sent events',
}

const chatTemplate: EndpointTemplate = {
  titleKey: 'Chat Completions',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'messages',
      type: 'array',
      required: true,
      description:
        'Conversation messages; each item has a role (system, user or assistant) and content',
    },
    streamParam,
    {
      name: 'temperature',
      type: 'number',
      required: false,
      description: 'Sampling temperature from 0 to 2; lower is more focused',
    },
    {
      name: 'max_tokens',
      type: 'integer',
      required: false,
      description: 'Maximum number of tokens to generate',
    },
    {
      name: 'tools',
      type: 'array',
      required: false,
      description: 'Functions the model may call, in OpenAI tool format',
    },
  ],
  request: (model) => ({
    model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    stream: false,
  }),
  response: (model) => ({
    id: 'chatcmpl-xxxx',
    object: 'chat.completion',
    created: 1700000000,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello! How can I help you?' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 },
  }),
  notes: [
    'Compatible with the OpenAI SDK: set the base URL to this site + /v1 and use your API key.',
  ],
  followUps: [],
}

const responsesTemplate: EndpointTemplate = {
  titleKey: 'Responses',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'input',
      type: 'string | array',
      required: true,
      description: 'Text, or a list of message items, to send to the model',
    },
    {
      name: 'instructions',
      type: 'string',
      required: false,
      description: 'System-level instructions for the model',
    },
    streamParam,
    {
      name: 'max_output_tokens',
      type: 'integer',
      required: false,
      description: 'Maximum number of tokens to generate',
    },
  ],
  request: (model) => ({ model, input: 'Hello!' }),
  response: (model) => ({
    id: 'resp_xxxx',
    object: 'response',
    status: 'completed',
    model,
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hello! How can I help you?' }],
      },
    ],
    usage: { input_tokens: 9, output_tokens: 9, total_tokens: 18 },
  }),
  notes: [
    'Compatible with the OpenAI SDK: set the base URL to this site + /v1 and use your API key.',
  ],
  followUps: [],
}

const anthropicTemplate: EndpointTemplate = {
  titleKey: 'Messages (Claude format)',
  auth: 'x-api-key',
  params: [
    modelParam,
    {
      name: 'max_tokens',
      type: 'integer',
      required: true,
      description: 'Maximum number of tokens to generate',
    },
    {
      name: 'messages',
      type: 'array',
      required: true,
      description:
        'Conversation messages; each item has a role (user or assistant) and content',
    },
    {
      name: 'system',
      type: 'string',
      required: false,
      description: 'System prompt',
    },
    streamParam,
  ],
  request: (model) => ({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
  response: (model) => ({
    id: 'msg_xxxx',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: 'Hello! How can I help you?' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 9 },
  }),
  notes: [
    'Compatible with the Anthropic SDK: set the base URL to this site and use your API key.',
    'The key can also be sent as Authorization: Bearer.',
  ],
  followUps: [],
}

const geminiTemplate: EndpointTemplate = {
  titleKey: 'Generate content (Gemini format)',
  auth: 'query-key',
  params: [
    {
      name: 'contents',
      type: 'array',
      required: true,
      description: 'Conversation turns; each has a role and a list of parts',
    },
    {
      name: 'generationConfig',
      type: 'object',
      required: false,
      description:
        'Generation settings such as temperature, maxOutputTokens and imageConfig',
    },
    {
      name: 'systemInstruction',
      type: 'object',
      required: false,
      description: 'System instruction, in the same parts format',
    },
  ],
  request: () => ({
    contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
  }),
  response: (model) => ({
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text: 'Hello! How can I help you?' }],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 2,
      candidatesTokenCount: 9,
      totalTokenCount: 11,
    },
    modelVersion: model,
  }),
  notes: [
    'The model name is part of the URL path. The key can also be sent in the x-goog-api-key header.',
  ],
  followUps: [],
}

const embeddingsTemplate: EndpointTemplate = {
  titleKey: 'Embeddings',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'input',
      type: 'string | array',
      required: true,
      description: 'Text, or a list of texts, to embed',
    },
    {
      name: 'dimensions',
      type: 'integer',
      required: false,
      description: 'Output vector size, if the model supports it',
    },
    {
      name: 'encoding_format',
      type: 'string',
      required: false,
      description: 'float (default) or base64',
    },
  ],
  request: (model) => ({ model, input: 'The food was delicious.' }),
  response: (model) => ({
    object: 'list',
    data: [{ object: 'embedding', index: 0, embedding: [0.0123, -0.0456] }],
    model,
    usage: { prompt_tokens: 6, total_tokens: 6 },
  }),
  notes: [],
  followUps: [],
}

const rerankTemplate: EndpointTemplate = {
  titleKey: 'Rerank',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'query',
      type: 'string',
      required: true,
      description: 'Search query',
    },
    {
      name: 'documents',
      type: 'array',
      required: true,
      description: 'Candidate texts to rank against the query',
    },
    {
      name: 'top_n',
      type: 'integer',
      required: false,
      description: 'Number of top results to return',
    },
    {
      name: 'return_documents',
      type: 'boolean',
      required: false,
      description: 'Include the document text in each result',
    },
  ],
  request: (model) => ({
    model,
    query: 'What is the capital of France?',
    documents: ['Paris is the capital of France.', 'Berlin is in Germany.'],
    top_n: 1,
  }),
  response: (model) => ({
    model,
    results: [{ index: 0, relevance_score: 0.98 }],
    usage: { total_tokens: 24 },
  }),
  notes: [],
  followUps: [],
}

const imageTemplate: EndpointTemplate = {
  titleKey: 'Image generation',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Description of the image to generate',
    },
    {
      name: 'n',
      type: 'integer',
      required: false,
      description: 'Number of images to generate',
    },
    {
      name: 'size',
      type: 'string',
      required: false,
      description:
        'Image size such as 1024x1024; some models also accept ratios such as 16:9',
    },
    {
      name: 'response_format',
      type: 'string',
      required: false,
      description: 'url or b64_json',
    },
  ],
  request: (model) => ({
    model,
    prompt: 'A cute orange cat sitting on a windowsill, watercolor style',
    n: 1,
    size: '1024x1024',
  }),
  response: () => ({
    created: 1700000000,
    data: [{ url: 'https://example.com/generated/image.png' }],
  }),
  notes: [
    'To edit an image or use reference images, call POST /v1/images/edits with multipart form data (model, prompt, image).',
  ],
  followUps: [],
}

const videoTemplate: EndpointTemplate = {
  titleKey: 'Create video task',
  auth: 'bearer',
  params: [
    modelParam,
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Description of the video to generate',
    },
    {
      name: 'duration',
      type: 'integer',
      required: false,
      description:
        'Video length in seconds; allowed values depend on the model',
    },
    {
      name: 'ratio',
      type: 'string',
      required: false,
      description: 'Aspect ratio, for example 16:9 or 9:16',
    },
    {
      name: 'resolution',
      type: 'string',
      required: false,
      description: 'Output resolution, for example 720p or 1080p',
    },
    {
      name: 'images',
      type: 'array',
      required: false,
      description: 'Reference image URLs (public http or https links)',
    },
  ],
  request: (model) => ({
    model,
    prompt: 'A corgi running on the beach at sunset, cinematic',
    duration: 8,
    ratio: '16:9',
    resolution: '720p',
  }),
  response: (model) => ({
    id: 'video_xxxx',
    object: 'video',
    model,
    status: 'queued',
    progress: 0,
    created_at: 1700000000,
  }),
  notes: [
    'Video generation is asynchronous: create a task, then poll its status every 5 to 10 seconds until it is completed or failed.',
    'Task status is one of queued, in_progress, completed or failed.',
    'When the task is completed, download the video from GET /v1/videos/{task_id}/content with the same Authorization header.',
  ],
  followUps: [
    {
      method: 'GET',
      path: '/v1/videos/{task_id}',
      summaryKey: 'Query video task',
      response: (model) => ({
        id: 'video_xxxx',
        object: 'video',
        model,
        status: 'completed',
        progress: 100,
        created_at: 1700000000,
        completed_at: 1700000120,
        seconds: '8',
        size: '1280x720',
      }),
    },
    {
      method: 'GET',
      path: '/v1/videos/{task_id}/content',
      summaryKey: 'Download video file (MP4)',
      binary: true,
    },
  ],
}

const genericTemplate: EndpointTemplate = {
  titleKey: 'API endpoint',
  auth: 'bearer',
  params: [modelParam],
  request: (model) => ({ model }),
  response: () => ({}),
  notes: [],
  followUps: [],
}

export const ENDPOINT_TEMPLATES: Record<string, EndpointTemplate> = {
  openai: chatTemplate,
  'openai-response': responsesTemplate,
  anthropic: anthropicTemplate,
  gemini: geminiTemplate,
  embeddings: embeddingsTemplate,
  'jina-rerank': rerankTemplate,
  'image-generation': imageTemplate,
  'openai-video': videoTemplate,
}

export const DEFAULT_ENDPOINT_PATHS: Record<string, string> = {
  openai: '/v1/chat/completions',
  'openai-response': '/v1/responses',
  anthropic: '/v1/messages',
  gemini: '/v1beta/models/{model}:generateContent',
  embeddings: '/v1/embeddings',
  'jina-rerank': '/v1/rerank',
  'image-generation': '/v1/images/generations',
  'openai-video': '/v1/videos',
}

export function getEndpointTemplate(endpointType: string): EndpointTemplate {
  return ENDPOINT_TEMPLATES[endpointType] ?? genericTemplate
}

/** Order in which categories appear in the docs navigation. */
export const DOC_CATEGORIES: DocCategory[] = [
  'text',
  'image',
  'video',
  'audio',
  'embedding',
  'other',
]

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  text: 'Text APIs',
  image: 'Image APIs',
  video: 'Video APIs',
  audio: 'Audio APIs',
  embedding: 'Embedding & rerank APIs',
  other: 'Other APIs',
}

export function getDocCategory(model: {
  model_type?: string
  supported_endpoint_types?: string[]
}): DocCategory {
  const declared = model.model_type
  if (
    declared === 'text' ||
    declared === 'image' ||
    declared === 'video' ||
    declared === 'audio'
  ) {
    return declared
  }
  const types = model.supported_endpoint_types ?? []
  if (types.includes('openai-video')) return 'video'
  if (types.includes('image-generation')) return 'image'
  if (types.includes('embeddings') || types.includes('jina-rerank')) {
    return 'embedding'
  }
  if (declared === 'other') return 'other'
  return 'text'
}
