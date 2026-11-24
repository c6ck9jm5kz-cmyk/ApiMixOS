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
export type ModelDocParam = {
  name: string
  type: string
  required: boolean
  description: string
}

/**
 * Administrator-authored additions to a model's generated API doc.
 * `auto` keeps the generated doc and adds these supplements; `custom`
 * replaces the generated body with `markdown`.
 */
export type ModelDocContent = {
  mode: 'auto' | 'custom'
  summary: string
  notes: string[]
  params: ModelDocParam[]
  request_example: string
  response_example: string
  markdown: string
}

export type ModelDocRecord = {
  model_name: string
  content: ModelDocContent | null
  updated_time: number
}

export type ModelDocSummary = {
  model_name: string
  updated_time: number
}

export const EMPTY_MODEL_DOC: ModelDocContent = {
  mode: 'auto',
  summary: '',
  notes: [],
  params: [],
  request_example: '',
  response_example: '',
  markdown: '',
}
