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
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, test } from 'node:test'

import { EMPTY_MODEL_DOC } from '../../types'
import { docToMarkdown, resolveModelDoc } from '../build-doc'
import { getDocCategory } from '../templates'

const t = (key: string) => key
const baseUrl = 'https://ai60.top/'

/** Runs a generated curl command through bash and returns its arguments. */
function curlArgs(command: string): string[] {
  const result = spawnSync(
    'bash',
    ['-c', `curl() { printf '%s\\0' "$@"; }\n${command}`],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.split('\0').slice(0, -1)
}

function curlBody(command: string): unknown {
  const args = curlArgs(command)
  const index = args.indexOf('-d')
  assert.ok(index >= 0, 'curl command has no -d body')
  return JSON.parse(args[index + 1])
}

describe('resolveModelDoc', () => {
  test('video models get the async task flow with a valid JSON example', () => {
    const doc = resolveModelDoc({
      model: {
        model_name: 'veo-3.1-fast',
        supported_endpoint_types: ['openai-video'],
      },
      endpointMap: {},
      baseUrl,
      content: null,
      t,
    })
    assert.equal(doc.category, 'video')
    const [endpoint] = doc.endpoints
    assert.equal(endpoint.method, 'POST')
    assert.equal(endpoint.path, '/v1/videos')
    assert.deepEqual(
      endpoint.followUps.map((f) => `${f.method} ${f.path}`),
      ['GET /v1/videos/{task_id}', 'GET /v1/videos/{task_id}/content']
    )
    const args = curlArgs(endpoint.curl)
    assert.ok(args.includes('https://ai60.top/v1/videos'))
    assert.ok(args.includes('Authorization: Bearer sk-your-api-key'))
    assert.deepEqual(curlBody(endpoint.curl), {
      model: 'veo-3.1-fast',
      prompt: 'A corgi running on the beach at sunset, cinematic',
      duration: 8,
      ratio: '16:9',
      resolution: '720p',
    })
    assert.ok(
      curlArgs(endpoint.followUps[0].curl).includes(
        'https://ai60.top/v1/videos/video_xxxx'
      )
    )
  })

  test('admin supplements override, extend and replace the examples', () => {
    const doc = resolveModelDoc({
      model: {
        model_name: 'minimax-h3',
        description: 'MiniMax video',
        supported_endpoint_types: ['openai-video'],
      },
      endpointMap: { 'openai-video': { path: '/v1/videos', method: 'POST' } },
      baseUrl,
      content: {
        ...EMPTY_MODEL_DOC,
        notes: ['Prompt limit 7000 characters'],
        params: [
          {
            name: 'duration',
            type: 'integer',
            required: true,
            description: '5-15 seconds',
          },
          {
            name: 'audios',
            type: 'array',
            required: false,
            description: 'Up to 3 audio URLs',
          },
        ],
        request_example: `{"model":"minimax-h3","prompt":"it's a rabbit dancing","duration":5}`,
      },
      t,
    })
    const [endpoint] = doc.endpoints
    const duration = endpoint.params.find((p) => p.name === 'duration')
    assert.deepEqual(duration, {
      name: 'duration',
      type: 'integer',
      required: true,
      description: '5-15 seconds',
    })
    assert.equal(endpoint.params.at(-1)?.name, 'audios')
    assert.equal(doc.summary, 'MiniMax video')
    assert.deepEqual(doc.notes, ['Prompt limit 7000 characters'])
    assert.deepEqual(curlBody(endpoint.curl), {
      model: 'minimax-h3',
      prompt: "it's a rabbit dancing",
      duration: 5,
    })
  })

  test('gemini puts the model in the path and the key in the query', () => {
    const doc = resolveModelDoc({
      model: {
        model_name: 'gemini-4-neon',
        supported_endpoint_types: ['gemini'],
      },
      endpointMap: {
        gemini: {
          path: '/v1beta/models/{model}:generateContent',
          method: 'POST',
        },
      },
      baseUrl,
      content: null,
      t,
    })
    const args = curlArgs(doc.endpoints[0].curl)
    assert.ok(
      args.includes(
        'https://ai60.top/v1beta/models/gemini-4-neon:generateContent?key=sk-your-api-key'
      )
    )
  })

  test('custom mode exports only the admin markdown', () => {
    const doc = resolveModelDoc({
      model: { model_name: 'x', supported_endpoint_types: ['openai'] },
      endpointMap: {},
      baseUrl,
      content: { ...EMPTY_MODEL_DOC, mode: 'custom', markdown: '## Hello' },
      t,
    })
    assert.equal(docToMarkdown(doc, t), '# x\n\n## Hello\n')
  })

  test('markdown export escapes table pipes', () => {
    const doc = resolveModelDoc({
      model: { model_name: 'gpt', supported_endpoint_types: ['openai'] },
      endpointMap: {},
      baseUrl,
      content: {
        ...EMPTY_MODEL_DOC,
        params: [
          { name: 'mode', type: 'a | b', required: false, description: 'x' },
        ],
      },
      t,
    })
    assert.ok(docToMarkdown(doc, t).includes('| mode | a \\| b | No | x |'))
  })
})

describe('endpoint order', () => {
  test('video models lead with the video endpoint and drop chat', () => {
    const doc = resolveModelDoc({
      model: {
        model_name: 'seedance-2.5-sd8',
        model_type: 'video',
        supported_endpoint_types: ['openai', 'openai-video'],
      },
      endpointMap: {},
      baseUrl,
      content: null,
      t,
    })
    assert.deepEqual(
      doc.endpoints.map((e) => e.type),
      ['openai-video']
    )
  })

  test('image models lead with image generation but keep chat', () => {
    const doc = resolveModelDoc({
      model: {
        model_name: 'gpt-image-2.5',
        model_type: 'image',
        supported_endpoint_types: ['openai', 'image-generation'],
      },
      endpointMap: {},
      baseUrl,
      content: null,
      t,
    })
    assert.deepEqual(
      doc.endpoints.map((e) => e.type),
      ['image-generation', 'openai']
    )
  })
})

describe('getDocCategory', () => {
  test('declared model type wins, otherwise endpoints decide', () => {
    assert.equal(
      getDocCategory({
        model_type: 'image',
        supported_endpoint_types: ['openai'],
      }),
      'image'
    )
    assert.equal(
      getDocCategory({ supported_endpoint_types: ['jina-rerank'] }),
      'embedding'
    )
    assert.equal(
      getDocCategory({ supported_endpoint_types: ['openai'] }),
      'text'
    )
  })
})
