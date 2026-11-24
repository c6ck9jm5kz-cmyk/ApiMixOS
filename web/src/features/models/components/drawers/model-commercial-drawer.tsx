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
import { useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateSystemOption } from '@/features/system-settings/api'
import { useSystemOptions } from '@/features/system-settings/hooks/use-system-options'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  type ModelRatioData,
} from '@/features/system-settings/models/model-pricing-sheet'
import { buildModelSnapshots } from '@/features/system-settings/models/model-pricing-snapshots'

import { updateModelCommercialConfig } from '../../api'
import { modelsQueryKeys } from '../../lib'
import {
  buildPricingOptionUpdates,
  emptyModelCost,
  getOptionMap,
  parseModelCostMap,
  resolveModelCostEntry,
  type ModelCostEntry,
} from '../../lib/model-commercial'
import type { Model } from '../../types'

type ModelCommercialDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: Model | null
}

const costFieldsByType: Record<
  NonNullable<Model['model_type']>,
  Array<{ key: keyof ModelCostEntry; label: string; unit: string }>
> = {
  text: [
    { key: 'input_per_1m', label: 'Input', unit: '$ / 1M tokens' },
    { key: 'output_per_1m', label: 'Output', unit: '$ / 1M tokens' },
    { key: 'cache_read_per_1m', label: 'Cache read', unit: '$ / 1M tokens' },
    { key: 'cache_write_per_1m', label: 'Cache write', unit: '$ / 1M tokens' },
  ],
  audio: [
    { key: 'audio_input_per_1m', label: 'Audio input', unit: '$ / 1M tokens' },
    {
      key: 'audio_output_per_1m',
      label: 'Audio output',
      unit: '$ / 1M tokens',
    },
    { key: 'audio_input_per_second', label: 'Audio input', unit: '$ / second' },
    {
      key: 'audio_output_per_second',
      label: 'Audio output',
      unit: '$ / second',
    },
  ],
  image: [
    { key: 'image_token_per_1m', label: 'Image token', unit: '$ / 1M tokens' },
    { key: 'image_per_unit', label: 'Image', unit: '$ / image' },
    { key: 'request_fee', label: 'Request fee', unit: '$ / request' },
  ],
  video: [
    { key: 'video_per_second', label: 'Video', unit: '$ / second' },
    { key: 'request_fee', label: 'Request fee', unit: '$ / request' },
  ],
  other: [
    { key: 'request_fee', label: 'Request fee', unit: '$ / request' },
    { key: 'input_per_1m', label: 'Input', unit: '$ / 1M tokens' },
    { key: 'output_per_1m', label: 'Output', unit: '$ / 1M tokens' },
  ],
}

export function ModelCommercialDrawer(props: ModelCommercialDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const pricingRef = useRef<ModelPricingEditorPanelHandle>(null)
  const { data: optionsResponse } = useSystemOptions()
  const [activeTab, setActiveTab] = useState('pricing')
  const [scopeKey, setScopeKey] = useState('')
  const [cost, setCost] = useState<ModelCostEntry>(emptyModelCost())
  const [upstreamModel, setUpstreamModel] = useState('')
  const [isSavingPricing, setIsSavingPricing] = useState(false)
  const [isSavingCost, setIsSavingCost] = useState(false)

  const options = useMemo(
    () => getOptionMap(optionsResponse?.data),
    [optionsResponse?.data]
  )
  const costMap = useMemo(
    () => parseModelCostMap(options.ModelCost || '{}'),
    [options.ModelCost]
  )
  const modelName = props.model?.model_name || ''
  const modelType = props.model?.model_type || 'text'
  const supportsChannelOverrides = props.model?.name_rule === 0
  const selectedChannel = supportsChannelOverrides
    ? (props.model?.bound_channels || []).find(
        (channel) => `channel:${channel.id}:${modelName}` === scopeKey
      )
    : undefined
  const scopeOptions = useMemo(() => {
    if (!props.model) return []
    return [
      { value: props.model.model_name, label: t('Model default') },
      ...(props.model.name_rule === 0 ? props.model.bound_channels || [] : [])
        .filter((channel) => channel.id !== undefined)
        .map((channel) => ({
          value: `channel:${channel.id}:${props.model?.model_name}`,
          label: `${channel.name} (#${channel.id})`,
        })),
    ]
  }, [props.model, t])

  const pricingData = useMemo(() => {
    if (!modelName) return null
    const snapshots = buildModelSnapshots({
      modelPrice: options.ModelPrice || '{}',
      modelRatio: options.ModelRatio || '{}',
      cacheRatio: options.CacheRatio || '{}',
      createCacheRatio: options.CreateCacheRatio || '{}',
      completionRatio: options.CompletionRatio || '{}',
      imageRatio: options.ImageRatio || '{}',
      audioRatio: options.AudioRatio || '{}',
      audioCompletionRatio: options.AudioCompletionRatio || '{}',
      billingMode: options['billing_setting.billing_mode'] || '{}',
      billingExpr: options['billing_setting.billing_expr'] || '{}',
      taskBillingPricing:
        options['billing_setting.task_billing_pricing'] || '{}',
      scheduledDiscount: options['billing_setting.scheduled_discount'] || '{}',
    })
    const snapshot = snapshots.find((item) => item.name === modelName)
    if (!snapshot) {
      return {
        name: modelName,
        billingMode: 'per-token' as const,
      }
    }
    const billingMode = [
      'per-token',
      'per-request',
      'per-second',
      'tiered_expr',
    ].includes(snapshot.billingMode || '')
      ? (snapshot.billingMode as ModelRatioData['billingMode'])
      : 'per-token'
    return { ...snapshot, billingMode }
  }, [modelName, options])

  useEffect(() => {
    if (!props.open || !modelName) return
    setActiveTab('pricing')
    setScopeKey(modelName)
  }, [modelName, props.open])

  useEffect(() => {
    if (!scopeKey) return
    const channel = supportsChannelOverrides
      ? (props.model?.bound_channels || []).find(
          (item) => `channel:${item.id}:${modelName}` === scopeKey
        )
      : undefined
    setCost(
      costMap[scopeKey] ||
        resolveModelCostEntry(costMap, modelName, channel?.id) ||
        emptyModelCost()
    )
    setUpstreamModel(channel?.upstream_model || modelName)
  }, [
    costMap,
    modelName,
    props.model?.bound_channels,
    scopeKey,
    supportsChannelOverrides,
  ])

  const savePricing = async () => {
    const data = await pricingRef.current?.commitDraft()
    if (!data) return
    setIsSavingPricing(true)
    try {
      const updates = buildPricingOptionUpdates(options, data)
      for (const update of updates) {
        const result = await updateSystemOption(update)
        if (!result.success) throw new Error(result.message)
      }
      await queryClient.invalidateQueries({ queryKey: ['system-options'] })
      toast.success(t('Model pricing saved'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to update setting')
      )
    } finally {
      setIsSavingPricing(false)
    }
  }

  const saveCost = async () => {
    if (!scopeKey || !props.model) return
    setIsSavingCost(true)
    try {
      const response = await updateModelCommercialConfig(props.model.id, {
        channel_id: selectedChannel?.id || 0,
        upstream_model: selectedChannel ? upstreamModel : '',
        cost,
      })
      if (!response.success) throw new Error(response.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system-options'] }),
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.all }),
      ])
      toast.success(t('Upstream settings saved'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to update setting')
      )
    } finally {
      setIsSavingCost(false)
    }
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-3xl')}>
        <SheetHeader>
          <SheetTitle>
            {t('Pricing')} · {modelName}
          </SheetTitle>
          <SheetDescription>
            {t('Configure user pricing and upstream cost for this model.')}
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='flex min-h-0 flex-1 flex-col px-4 pb-4'
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='pricing'>{t('Sale Price')}</TabsTrigger>
            <TabsTrigger value='cost'>{t('Upstream Cost')}</TabsTrigger>
          </TabsList>
          <TabsContent value='pricing' className='min-h-0 flex-1'>
            <ModelPricingEditorPanel
              ref={pricingRef}
              editData={pricingData}
              onSave={savePricing}
              isSaving={isSavingPricing}
              className='h-full'
            />
          </TabsContent>
          <TabsContent value='cost' className='min-h-0 flex-1 overflow-y-auto'>
            <div className='space-y-5 rounded-lg border p-4'>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('Cost scope')}</FieldLabel>
                  <Select
                    items={scopeOptions}
                    value={scopeKey}
                    onValueChange={(value) => value && setScopeKey(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {scopeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t('Use the model default or override one bound channel.')}
                  </FieldDescription>
                </Field>
                <Field orientation='horizontal'>
                  <div className='flex-1'>
                    <FieldLabel>{t('Enabled')}</FieldLabel>
                    <FieldDescription>
                      {t('Include this cost in profit statistics.')}
                    </FieldDescription>
                  </div>
                  <Switch
                    checked={cost.enabled}
                    onCheckedChange={(enabled) => setCost({ ...cost, enabled })}
                  />
                </Field>
                {selectedChannel && (
                  <Field>
                    <FieldLabel>{t('Upstream model')}</FieldLabel>
                    <Input
                      value={upstreamModel}
                      maxLength={255}
                      onChange={(event) => setUpstreamModel(event.target.value)}
                    />
                    <FieldDescription>
                      {t(
                        'Users call the model on the left. The platform forwards the request to the upstream model on the right.'
                      )}
                    </FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel>{t('Currency')}</FieldLabel>
                  <Input
                    value={cost.currency}
                    maxLength={8}
                    onChange={(event) =>
                      setCost({
                        ...cost,
                        currency: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </Field>
                <div className='grid gap-4 sm:grid-cols-2'>
                  {costFieldsByType[modelType].map((field) => (
                    <Field key={field.key}>
                      <FieldLabel>{t(field.label)}</FieldLabel>
                      <div className='flex items-center gap-2'>
                        <DecimalInput
                          aria-label={t(field.label)}
                          value={
                            typeof cost[field.key] === 'number'
                              ? (cost[field.key] as number)
                              : undefined
                          }
                          onValueChange={(value) =>
                            setCost((current) => ({
                              ...current,
                              [field.key]: value ?? 0,
                            }))
                          }
                        />
                        <span className='text-muted-foreground w-28 shrink-0 text-xs'>
                          {field.unit}
                        </span>
                      </div>
                    </Field>
                  ))}
                </div>
                {modelType === 'video' && (
                  <ResolutionCostFields
                    value={cost.video_per_second_by_resolution}
                    onChange={(value) =>
                      setCost({
                        ...cost,
                        video_per_second_by_resolution: value,
                      })
                    }
                  />
                )}
              </FieldGroup>
              <div className='flex justify-end border-t pt-4'>
                <Button onClick={saveCost} disabled={isSavingCost}>
                  <Save data-icon='inline-start' />
                  {isSavingCost ? t('Saving...') : t('Save upstream settings')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function ResolutionCostFields(props: {
  value: Record<string, number>
  onChange: (value: Record<string, number>) => void
}) {
  const { t } = useTranslation()
  const resolutions = ['480p', '720p', '768p', '1080p', '1440p', '4k']
  const label = (resolution: string) => {
    if (resolution === '1440p') return '2K'
    if (resolution === '4k') return '4K'
    return resolution.toUpperCase()
  }
  return (
    <Field>
      <FieldLabel>{t('Video')}</FieldLabel>
      <FieldDescription>
        {t(
          'Configure upstream cost only; this does not change user pricing or model routing.'
        )}
      </FieldDescription>
      <div className='grid gap-3 sm:grid-cols-2'>
        {resolutions.map((resolution) => (
          <div key={resolution} className='flex items-center gap-2'>
            <span className='w-14 text-sm'>{label(resolution)}</span>
            <DecimalInput
              aria-label={`${resolution} ${t('Video')}`}
              value={props.value[resolution]}
              onValueChange={(value) => {
                const next = { ...props.value }
                if (value === undefined) delete next[resolution]
                else next[resolution] = value
                props.onChange(next)
              }}
            />
            <span className='text-muted-foreground text-xs'>$ / sec</span>
          </div>
        ))}
      </div>
    </Field>
  )
}
