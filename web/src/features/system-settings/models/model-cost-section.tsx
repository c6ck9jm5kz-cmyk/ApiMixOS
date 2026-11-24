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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type CostEntry = {
  currency: string
  enabled: boolean
  input_per_1m: number
  output_per_1m: number
  cache_read_per_1m: number
  cache_write_per_1m: number
  image_token_per_1m: number
  image_per_unit: number
  audio_input_per_1m: number
  audio_output_per_1m: number
  audio_input_per_second: number
  audio_output_per_second: number
  video_per_second: number
  video_per_second_by_resolution: Record<string, number>
  request_fee: number
}

type CostMap = Record<string, CostEntry>

const emptyEntry = (): CostEntry => ({
  currency: 'USD',
  enabled: true,
  input_per_1m: 0,
  output_per_1m: 0,
  cache_read_per_1m: 0,
  cache_write_per_1m: 0,
  image_token_per_1m: 0,
  image_per_unit: 0,
  audio_input_per_1m: 0,
  audio_output_per_1m: 0,
  audio_input_per_second: 0,
  audio_output_per_second: 0,
  video_per_second: 0,
  video_per_second_by_resolution: {},
  request_fee: 0,
})

function parseCostMap(raw: string): CostMap {
  const parsed: unknown = JSON.parse(raw || '{}')
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Cost configuration must be a JSON object')
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid cost entry: ${key}`)
      }
      return [key, { ...emptyEntry(), ...(value as Partial<CostEntry>) }]
    })
  )
}

function serializeCostMap(costs: CostMap) {
  return JSON.stringify(costs, null, 2)
}

export function ModelCostSection({ defaultValue }: { defaultValue: string }) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [costs, setCosts] = useState<CostMap>({})
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      setCosts(parseCostMap(defaultValue))
      setError('')
    } catch (value) {
      setCosts({})
      setError(value instanceof Error ? value.message : String(value))
    }
  }, [defaultValue])

  const entries = useMemo(() => Object.entries(costs), [costs])

  const updateEntry = (
    key: string,
    field: keyof CostEntry,
    value: string | boolean | Record<string, number>
  ) => {
    let normalizedValue: string | number | boolean | Record<string, number> =
      value
    if (field === 'currency') {
      normalizedValue = String(value)
    } else if (field === 'enabled') {
      normalizedValue = Boolean(value)
    } else if (field === 'video_per_second_by_resolution') {
      normalizedValue = value as Record<string, number>
    } else {
      normalizedValue = Number(value) || 0
    }
    setCosts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: normalizedValue,
      },
    }))
  }

  const addEntry = () => {
    const key = newKey.trim()
    if (!key || costs[key]) return
    setCosts((current) => ({ ...current, [key]: emptyEntry() }))
    setNewKey('')
  }

  const removeEntry = (key: string) => {
    setCosts((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const save = async () => {
    if (error) return
    try {
      await updateOption.mutateAsync({
        key: 'ModelCost',
        value: serializeCostMap(costs),
      })
      toast.success(t('Model cost configuration saved'))
    } catch {
      // useUpdateOption owns the error toast
    }
  }

  return (
    <SettingsSection title={t('Upstream Model Costs')}>
      <div className='text-muted-foreground rounded-lg border p-4 text-sm'>
        <p>
          {t(
            'Configure upstream cost only; this does not change user pricing or model routing.'
          )}
        </p>
        <p className='mt-1'>
          {t(
            'Token fields are USD per 1M tokens. Unit fields are USD per image or second.'
          )}
        </p>
        <p className='mt-1'>
          {t(
            'Use model names for defaults, channel:ID:model for channel overrides, and default for the fallback.'
          )}
        </p>
      </div>
      <div className='overflow-x-auto rounded-lg border'>
        <table className='w-full min-w-[1680px] text-sm'>
          <thead className='bg-muted/40 text-left'>
            <tr>
              <th className='p-2'>{t('Model or override key')}</th>
              <th className='p-2'>{t('Currency')}</th>
              <th className='p-2'>{t('Enabled')}</th>
              <th className='p-2'>{t('Input $/1M')}</th>
              <th className='p-2'>{t('Output $/1M')}</th>
              <th className='p-2'>{t('Cache read $/1M')}</th>
              <th className='p-2'>{t('Cache write $/1M')}</th>
              <th className='p-2'>{t('Image token $/1M')}</th>
              <th className='p-2'>{t('Image $/unit')}</th>
              <th className='p-2'>{t('Audio input $/1M')}</th>
              <th className='p-2'>{t('Audio output $/1M')}</th>
              <th className='p-2'>{t('Audio input $/sec')}</th>
              <th className='p-2'>{t('Audio output $/sec')}</th>
              <th className='p-2'>{t('Video $/sec')}</th>
              <th className='p-2'>{t('Request fee $/request')}</th>
              <th className='p-2'>{t('Action')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, entry]) => (
              <tr key={key} className='border-t'>
                <td className='p-2 font-mono'>{key}</td>
                <td className='p-2'>
                  <Input
                    aria-label={`${key} ${t('Currency')}`}
                    className='w-20 uppercase'
                    maxLength={8}
                    value={entry.currency}
                    onChange={(event) =>
                      updateEntry(
                        key,
                        'currency',
                        event.target.value.toUpperCase()
                      )
                    }
                  />
                </td>
                <td className='p-2'>
                  <Switch
                    aria-label={`${key} ${t('Enabled')}`}
                    checked={entry.enabled}
                    onCheckedChange={(checked) =>
                      updateEntry(key, 'enabled', checked)
                    }
                  />
                </td>
                {(
                  [
                    'input_per_1m',
                    'output_per_1m',
                    'cache_read_per_1m',
                    'cache_write_per_1m',
                    'image_token_per_1m',
                    'image_per_unit',
                    'audio_input_per_1m',
                    'audio_output_per_1m',
                    'audio_input_per_second',
                    'audio_output_per_second',
                    'video_per_second',
                    'request_fee',
                  ] as const
                ).map((field) => (
                  <td key={field} className='p-2'>
                    <DecimalInput
                      aria-label={`${key} ${field}`}
                      className='w-24'
                      value={entry[field]}
                      onValueChange={(value) =>
                        updateEntry(key, field, String(value ?? 0))
                      }
                    />
                  </td>
                ))}
                <td className='p-2'>
                  <Button
                    type='button'
                    variant='destructive'
                    size='sm'
                    onClick={() => removeEntry(key)}
                  >
                    {t('Remove')}
                  </Button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={16}
                  className='text-muted-foreground p-4 text-center'
                >
                  {t('No upstream costs configured')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          aria-label={t('New model or override key')}
          placeholder='gpt-4o or channel:12:gpt-4o'
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button type='button' variant='outline' onClick={addEntry}>
          {t('Add model cost')}
        </Button>
        <Button
          type='button'
          onClick={save}
          disabled={updateOption.isPending || Boolean(error)}
        >
          {t('Save upstream costs')}
        </Button>
      </div>
      {error && <p className='text-destructive text-sm'>{error}</p>}
    </SettingsSection>
  )
}
