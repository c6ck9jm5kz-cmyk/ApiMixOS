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
import { BookOpen, ChevronDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  DOC_CATEGORIES,
  DOC_CATEGORY_LABELS,
  type DocCategory,
} from '../lib/templates'

export type DocNavModel = {
  model_name: string
  category: DocCategory
  vendor_name?: string
  vendor_icon?: string
  icon?: string
}

type VendorGroup = { vendor: string; icon?: string; models: DocNavModel[] }

export function DocsSidebar(props: {
  models: DocNavModel[]
  selected: string | null
  onSelect: (modelName: string | null) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const visible = props.models.filter(
      (model) =>
        !keyword ||
        model.model_name.toLowerCase().includes(keyword) ||
        (model.vendor_name ?? '').toLowerCase().includes(keyword)
    )
    return DOC_CATEGORIES.map((category) => {
      const vendors = new Map<string, VendorGroup>()
      for (const model of visible) {
        if (model.category !== category) continue
        const vendor = model.vendor_name || t('Other')
        const group = vendors.get(vendor) ?? {
          vendor,
          icon: model.vendor_icon,
          models: [],
        }
        group.models.push(model)
        vendors.set(vendor, group)
      }
      const vendorGroups = [...vendors.values()].sort((a, b) =>
        a.vendor.localeCompare(b.vendor)
      )
      for (const group of vendorGroups) {
        group.models.sort((a, b) => a.model_name.localeCompare(b.model_name))
      }
      return {
        category,
        vendors: vendorGroups,
        count: vendorGroups.reduce((sum, g) => sum + g.models.length, 0),
      }
    }).filter((group) => group.count > 0)
  }, [props.models, query, t])

  const toggle = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }))

  return (
    <nav className='flex h-full min-h-0 flex-col gap-3'>
      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search models or vendors...')}
          aria-label={t('Search models or vendors...')}
          className='pl-8'
        />
      </div>
      <button
        type='button'
        onClick={() => props.onSelect(null)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium',
          props.selected === null
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted'
        )}
      >
        <BookOpen className='size-4' />
        {t('Getting started')}
      </button>
      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'>
        {groups.length === 0 && (
          <p className='text-muted-foreground px-3 text-sm'>
            {t('No matching models')}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.category}>
            <div className='text-muted-foreground flex items-center justify-between px-3 pb-1 text-xs font-semibold tracking-wide uppercase'>
              <span>{t(DOC_CATEGORY_LABELS[group.category])}</span>
              <span>{group.count}</span>
            </div>
            {group.vendors.map((vendor) => {
              const key = `${group.category}:${vendor.vendor}`
              const isCollapsed = collapsed[key] && !query
              const vendorIcon = vendor.icon
                ? getLobeIcon(vendor.icon, 18)
                : null
              return (
                <div key={key}>
                  <button
                    type='button'
                    onClick={() => toggle(key)}
                    aria-expanded={!isCollapsed}
                    className='hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium'
                  >
                    <span className='flex size-5 items-center justify-center'>
                      {vendorIcon}
                    </span>
                    <span className='flex-1 truncate text-left'>
                      {vendor.vendor}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {vendor.models.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground size-4 transition-transform',
                        isCollapsed && '-rotate-90'
                      )}
                    />
                  </button>
                  {!isCollapsed && (
                    <ul className='border-border/70 ml-5 border-l py-0.5'>
                      {vendor.models.map((model) => (
                        <li key={model.model_name}>
                          <button
                            type='button'
                            onClick={() => props.onSelect(model.model_name)}
                            aria-current={
                              props.selected === model.model_name
                                ? 'page'
                                : undefined
                            }
                            className={cn(
                              '-ml-px w-full truncate border-l-2 px-3 py-1.5 text-left font-mono text-[13px]',
                              props.selected === model.model_name
                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                : 'text-muted-foreground hover:text-foreground border-transparent'
                            )}
                            title={model.model_name}
                          >
                            {model.model_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
