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
import { api } from '@/lib/api'

import type { ModelDocContent, ModelDocRecord, ModelDocSummary } from './types'

type ApiResponse<T> = { success: boolean; message?: string; data?: T }

export async function getPublicModelDoc(
  modelName: string
): Promise<ApiResponse<ModelDocRecord>> {
  const res = await api.get('/api/docs/model', {
    params: { model: modelName },
  })
  return res.data
}

export async function listModelDocs(): Promise<ApiResponse<ModelDocSummary[]>> {
  const res = await api.get('/api/model_docs/')
  return res.data
}

export async function getModelDocAdmin(
  modelName: string
): Promise<ApiResponse<ModelDocRecord>> {
  const res = await api.get('/api/model_docs/detail', {
    params: { model: modelName },
  })
  return res.data
}

export async function saveModelDoc(
  modelName: string,
  content: ModelDocContent
): Promise<ApiResponse<ModelDocRecord>> {
  const res = await api.put('/api/model_docs/', {
    model_name: modelName,
    content,
  })
  return res.data
}

export async function deleteModelDoc(
  modelName: string
): Promise<ApiResponse<null>> {
  const res = await api.delete('/api/model_docs/', {
    params: { model: modelName },
  })
  return res.data
}
