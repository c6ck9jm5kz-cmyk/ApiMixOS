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
import type { ModelDocContent, ModelDocParam } from '../types'
import {
  DEFAULT_ENDPOINT_PATHS,
  getDocCategory,
  getEndpointTemplate,
  type DocAuthStyle,
  type DocCategory,
} from './templates'

export type Translate = (
  key: string,
  options?: Record<string, unknown>
) => string

export const API_KEY_PLACEHOLDER = 'sk-your-api-key'
const TASK_ID_PLACEHOLDER = 'video_xxxx'

export type DocModelInput = {
  model_name: string
  description?: string
  model_type?: string
  supported_endpoint_types?: string[]
}

export type ResolvedFollowUp = {
  method: string
  path: string
  summary: string
  curl: string
  responseJson?: string
}

export type ResolvedEndpoint = {
  type: string
  title: string
  method: string
  path: string
  params: ModelDocParam[]
  requestJson: string
  curl: string
  responseJson: string
  notes: string[]
  followUps: ResolvedFollowUp[]
}

export type ResolvedDoc = {
  modelName: string
  category: DocCategory
  summary: string
  mode: 'auto' | 'custom'
  endpoints: ResolvedEndpoint[]
  /** Administrator notes, shown before the generic endpoint notes. */
  notes: string[]
  markdown: string
}

function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Pretty-prints JSON written by an admin; leaves non-JSON text untouched. */
function normalizeExample(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  try {
    return prettyJson(JSON.parse(text))
  } catch {
    return text
  }
}

function buildCurl(options: {
  method: string
  url: string
  auth: DocAuthStyle
  body?: string
}): string {
  const url =
    options.auth === 'query-key'
      ? `${options.url}${options.url.includes('?') ? '&' : '?'}key=${API_KEY_PLACEHOLDER}`
      : options.url
  const lines = [`curl -X ${options.method} ${shellQuote(url)}`]
  if (options.auth === 'bearer') {
    lines.push(`-H 'Authorization: Bearer ${API_KEY_PLACEHOLDER}'`)
  }
  if (options.auth === 'x-api-key') {
    lines.push(`-H 'x-api-key: ${API_KEY_PLACEHOLDER}'`)
    lines.push(`-H 'anthropic-version: 2023-06-01'`)
  }
  if (options.body !== undefined) {
    lines.push(`-H 'Content-Type: application/json'`)
    lines.push(`-d ${shellQuote(options.body)}`)
  }
  return lines.join(' \\\n  ')
}

/** Admin parameters replace template rows with the same name and add new ones. */
function mergeParams(
  base: ModelDocParam[],
  extra: ModelDocParam[]
): ModelDocParam[] {
  const merged = base.map((param) => {
    const override = extra.find((item) => item.name === param.name)
    return override ? { ...override } : param
  })
  for (const param of extra) {
    if (!merged.some((item) => item.name === param.name)) merged.push(param)
  }
  return merged
}

export function resolveModelDoc(options: {
  model: DocModelInput
  endpointMap: Record<string, { path?: string; method?: string }>
  baseUrl: string
  content: ModelDocContent | null
  t: Translate
}): ResolvedDoc {
  const { model, content, t } = options
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const modelName = model.model_name
  const endpointTypes = model.supported_endpoint_types?.length
    ? model.supported_endpoint_types
    : ['openai']

  const endpoints = endpointTypes.map((type, index) => {
    const template = getEndpointTemplate(type)
    const info = options.endpointMap[type] ?? {}
    const path = (info.path || DEFAULT_ENDPOINT_PATHS[type] || '').replaceAll(
      '{model}',
      modelName
    )
    const method = (info.method || 'POST').toUpperCase()
    const isPrimary = index === 0
    // Translate template descriptions; admin text is shown as written.
    const templateParams = template.params.map((param) => ({
      ...param,
      description: t(param.description),
    }))
    const params = mergeParams(templateParams, content?.params ?? [])
    const adminRequest =
      isPrimary && content ? normalizeExample(content.request_example) : ''
    const adminResponse =
      isPrimary && content ? normalizeExample(content.response_example) : ''
    const requestJson = adminRequest || prettyJson(template.request(modelName))
    const followUps = template.followUps.map((followUp) => ({
      method: followUp.method,
      path: followUp.path,
      summary: t(followUp.summaryKey),
      curl: buildCurl({
        method: followUp.method,
        url: `${baseUrl}${followUp.path.replace('{task_id}', TASK_ID_PLACEHOLDER)}`,
        auth: template.auth,
      }),
      responseJson: followUp.response
        ? prettyJson(followUp.response(modelName))
        : undefined,
    }))
    return {
      type,
      title: t(template.titleKey),
      method,
      path,
      params,
      requestJson,
      curl: buildCurl({
        method,
        url: `${baseUrl}${path}`,
        auth: template.auth,
        body: method === 'GET' ? undefined : requestJson,
      }),
      responseJson: adminResponse || prettyJson(template.response(modelName)),
      notes: template.notes.map((note) => t(note)),
      followUps,
    }
  })

  return {
    modelName,
    category: getDocCategory(model),
    summary: content?.summary || model.description || '',
    mode: content?.mode === 'custom' ? 'custom' : 'auto',
    endpoints,
    notes: content?.notes ?? [],
    markdown: content?.markdown ?? '',
  }
}

function tableCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

/** Markdown version of a doc, for the copy and download buttons. */
export function docToMarkdown(doc: ResolvedDoc, t: Translate): string {
  const lines: string[] = [`# ${doc.modelName}`, '']
  if (doc.summary) lines.push(doc.summary, '')
  if (doc.mode === 'custom') {
    lines.push(doc.markdown.trim(), '')
    return `${lines.join('\n').trimEnd()}\n`
  }

  lines.push(`## ${t('Endpoints')}`, '')
  for (const endpoint of doc.endpoints) {
    lines.push(`- ${endpoint.method} ${endpoint.path}: ${endpoint.title}`)
    for (const followUp of endpoint.followUps) {
      lines.push(`- ${followUp.method} ${followUp.path}: ${followUp.summary}`)
    }
  }
  lines.push('')

  const notes = [...doc.notes, ...doc.endpoints.flatMap((e) => e.notes)]
  if (notes.length > 0) {
    lines.push(`## ${t('Notes')}`, '')
    for (const note of notes) lines.push(`- ${note}`)
    lines.push('')
  }

  for (const endpoint of doc.endpoints) {
    lines.push(`## ${endpoint.title}`, '')
    lines.push(`\`${endpoint.method} ${endpoint.path}\``, '')
    lines.push(`### ${t('Request parameters')}`, '')
    lines.push(
      `| ${t('Parameter')} | ${t('Type')} | ${t('Required')} | ${t('Description')} |`
    )
    lines.push('| --- | --- | --- | --- |')
    for (const param of endpoint.params) {
      lines.push(
        `| ${tableCell(param.name)} | ${tableCell(param.type)} | ${param.required ? t('Yes') : t('No')} | ${tableCell(param.description)} |`
      )
    }
    lines.push('')
    lines.push(
      `### ${t('Request example')}`,
      '',
      '```bash',
      endpoint.curl,
      '```',
      ''
    )
    lines.push(
      `### ${t('Response example')}`,
      '',
      '```json',
      endpoint.responseJson,
      '```',
      ''
    )
    for (const followUp of endpoint.followUps) {
      lines.push(`### ${followUp.summary}`, '')
      lines.push(`\`${followUp.method} ${followUp.path}\``, '')
      lines.push('```bash', followUp.curl, '```', '')
      if (followUp.responseJson) {
        lines.push('```json', followUp.responseJson, '```', '')
      }
    }
  }

  if (doc.markdown.trim()) {
    lines.push(`## ${t('Additional information')}`, '', doc.markdown.trim(), '')
  }
  return `${lines.join('\n').trimEnd()}\n`
}
