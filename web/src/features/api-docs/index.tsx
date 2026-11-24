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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { useStatus } from '@/hooks/use-status'

import { getPublicModelDoc } from './api'
import { DocView } from './components/doc-view'
import { DocsSidebar, type DocNavModel } from './components/docs-sidebar'
import { GeneralGuide } from './components/general-guide'
import { resolveModelDoc } from './lib/build-doc'
import { getDocCategory } from './lib/templates'

const route = getRouteApi('/docs/')

export function ApiDocs() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = route.useSearch()
  const { status } = useStatus()
  const { models, endpointMap, isLoading } = usePricingData()

  const baseUrl = useMemo(() => {
    const address = (status as Record<string, unknown> | null)?.server_address
    if (typeof address === 'string' && address.trim()) {
      return address.trim().replace(/\/+$/, '')
    }
    return window.location.origin
  }, [status])

  const navModels = useMemo<DocNavModel[]>(
    () =>
      models.map((model) => ({
        model_name: model.model_name,
        category: getDocCategory(model),
        vendor_name: model.vendor_name,
        vendor_icon: model.vendor_icon,
        icon: model.icon,
      })),
    [models]
  )

  const selectedModel = useMemo(
    () => models.find((model) => model.model_name === search.model) ?? null,
    [models, search.model]
  )
  const selectedName = selectedModel?.model_name ?? null

  const docQuery = useQuery({
    queryKey: ['public-model-doc', selectedName],
    queryFn: () => getPublicModelDoc(selectedName ?? ''),
    enabled: Boolean(selectedName),
    staleTime: 60 * 1000,
  })

  const doc = useMemo(() => {
    if (!selectedModel) return null
    const content = docQuery.data?.success
      ? (docQuery.data.data?.content ?? null)
      : null
    return resolveModelDoc({
      model: selectedModel,
      endpointMap: endpointMap as unknown as Record<
        string,
        { path?: string; method?: string }
      >,
      baseUrl,
      content,
      t,
    })
  }, [selectedModel, docQuery.data, endpointMap, baseUrl, t])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [selectedName])

  const selectModel = (modelName: string | null) => {
    void navigate({
      to: '/docs',
      search: modelName ? { model: modelName } : {},
    })
  }

  let mainContent: ReactNode
  if (isLoading || (selectedModel && docQuery.isLoading)) {
    mainContent = (
      <div className='space-y-4'>
        <Skeleton className='h-14 w-1/2' />
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  } else if (doc && selectedModel) {
    mainContent = (
      <DocView
        doc={doc}
        icon={selectedModel.icon || selectedModel.vendor_icon}
        vendorName={selectedModel.vendor_name}
      />
    )
  } else {
    mainContent = <GeneralGuide baseUrl={baseUrl} modelCount={models.length} />
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto grid w-full max-w-[1600px] gap-6 px-3 pt-20 pb-12 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 xl:px-8'>
        <aside className='bg-card h-80 rounded-xl border p-3 lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)] lg:border-0 lg:bg-transparent lg:p-0'>
          {isLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className='h-8 w-full' />
              ))}
            </div>
          ) : (
            <DocsSidebar
              models={navModels}
              selected={selectedName}
              onSelect={selectModel}
            />
          )}
        </aside>
        <main className='min-w-0'>{mainContent}</main>
      </div>
    </PublicLayout>
  )
}
