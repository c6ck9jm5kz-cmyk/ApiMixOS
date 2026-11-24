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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteModelDoc,
  getModelDocAdmin,
  saveModelDoc,
} from '@/features/api-docs/api'
import {
  EMPTY_MODEL_DOC,
  type ModelDocContent,
  type ModelDocParam,
} from '@/features/api-docs/types'

import type { Model } from '../../types'

function jsonProblem(text: string): string | null {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

type ParamRow = ModelDocParam & { rowKey: number }

export function ModelDocDrawer(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: Model | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const modelName = props.model?.model_name ?? ''
  const [content, setContent] = useState<ModelDocContent>(EMPTY_MODEL_DOC)
  const [notesText, setNotesText] = useState('')
  const [paramRows, setParamRows] = useState<ParamRow[]>([])
  const nextRowKey = useRef(0)
  const [isSaving, setIsSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const docQuery = useQuery({
    queryKey: ['model-doc-admin', modelName],
    queryFn: () => getModelDocAdmin(modelName),
    enabled: props.open && Boolean(modelName),
  })

  useEffect(() => {
    if (!props.open) return
    const saved = docQuery.data?.data?.content
    const next = saved ? { ...EMPTY_MODEL_DOC, ...saved } : EMPTY_MODEL_DOC
    setContent(next)
    setNotesText(next.notes.join('\n'))
    setParamRows(
      next.params.map((param) => ({ ...param, rowKey: nextRowKey.current++ }))
    )
  }, [docQuery.data, props.open])

  const update = (patch: Partial<ModelDocContent>) =>
    setContent((current) => ({ ...current, ...patch }))

  const updateParam = (rowKey: number, patch: Partial<ModelDocParam>) =>
    setParamRows((rows) =>
      rows.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row))
    )

  const requestProblem = jsonProblem(content.request_example)
  const responseProblem = jsonProblem(content.response_example)

  const refreshDocs = async () => {
    await queryClient.invalidateQueries({ queryKey: ['model-doc-admin'] })
    await queryClient.invalidateQueries({ queryKey: ['public-model-doc'] })
  }

  const save = async () => {
    if (requestProblem || responseProblem) {
      toast.error(t('Examples must be valid JSON'))
      return
    }
    setIsSaving(true)
    try {
      const notes = notesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const params = paramRows.map(({ rowKey: _rowKey, ...param }) => param)
      const result = await saveModelDoc(modelName, {
        ...content,
        notes,
        params,
      })
      if (!result.success) throw new Error(result.message)
      await refreshDocs()
      toast.success(t('API doc saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Save failed'))
    } finally {
      setIsSaving(false)
    }
  }

  const resetToAuto = async () => {
    try {
      const result = await deleteModelDoc(modelName)
      if (!result.success) throw new Error(result.message)
      await refreshDocs()
      setContent(EMPTY_MODEL_DOC)
      setNotesText('')
      setParamRows([])
      setResetOpen(false)
      toast.success(t('API doc reset to auto-generated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Save failed'))
    }
  }

  const hasSavedDoc = Boolean(docQuery.data?.data?.content)

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-3xl')}>
        <SheetHeader>
          <SheetTitle>
            {t('API doc')} · {modelName}
          </SheetTitle>
          <SheetDescription>
            {t(
              'The doc center generates this model’s endpoint, parameters and examples automatically. Add model-specific limits here, or replace the whole doc.'
            )}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
          <Tabs
            value={content.mode}
            onValueChange={(mode) =>
              update({ mode: mode as ModelDocContent['mode'] })
            }
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='auto'>
                {t('Auto-generated + supplements')}
              </TabsTrigger>
              <TabsTrigger value='custom'>{t('Fully custom')}</TabsTrigger>
            </TabsList>
          </Tabs>

          <FieldGroup>
            <Field>
              <FieldLabel>{t('Summary')}</FieldLabel>
              <Input
                value={content.summary}
                onChange={(event) => update({ summary: event.target.value })}
                placeholder={t('Defaults to the model description')}
              />
            </Field>

            {content.mode === 'custom' ? (
              <Field>
                <FieldLabel>{t('Doc content (Markdown)')}</FieldLabel>
                <Textarea
                  className='min-h-96 font-mono text-sm'
                  value={content.markdown}
                  onChange={(event) => update({ markdown: event.target.value })}
                />
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel>{t('Notes')}</FieldLabel>
                  <FieldDescription>
                    {t(
                      'One per line, e.g. prompt length limit, maximum images, allowed durations.'
                    )}
                  </FieldDescription>
                  <Textarea
                    className='min-h-28'
                    value={notesText}
                    onChange={(event) => setNotesText(event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t('Parameters')}</FieldLabel>
                  <FieldDescription>
                    {t(
                      'A parameter with the same name replaces the generated row; new names are added.'
                    )}
                  </FieldDescription>
                  <div className='space-y-2'>
                    {paramRows.map((param) => (
                      <div
                        key={param.rowKey}
                        className='grid grid-cols-[1fr_0.8fr_auto_2fr_auto] items-center gap-2'
                      >
                        <Input
                          aria-label={t('Parameter')}
                          placeholder={t('Parameter')}
                          className='font-mono'
                          value={param.name}
                          onChange={(event) =>
                            updateParam(param.rowKey, {
                              name: event.target.value,
                            })
                          }
                        />
                        <Input
                          aria-label={t('Type')}
                          placeholder='string'
                          className='font-mono'
                          value={param.type}
                          onChange={(event) =>
                            updateParam(param.rowKey, {
                              type: event.target.value,
                            })
                          }
                        />
                        <label className='flex items-center gap-1.5 text-xs whitespace-nowrap'>
                          <Switch
                            checked={param.required}
                            onCheckedChange={(checked) =>
                              updateParam(param.rowKey, { required: checked })
                            }
                          />
                          {t('Required')}
                        </label>
                        <Input
                          aria-label={t('Description')}
                          placeholder={t('Description')}
                          value={param.description}
                          onChange={(event) =>
                            updateParam(param.rowKey, {
                              description: event.target.value,
                            })
                          }
                        />
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label={t('Remove')}
                          onClick={() =>
                            setParamRows((rows) =>
                              rows.filter((row) => row.rowKey !== param.rowKey)
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setParamRows((rows) => [
                          ...rows,
                          {
                            name: '',
                            type: 'string',
                            required: false,
                            description: '',
                            rowKey: nextRowKey.current++,
                          },
                        ])
                      }
                    >
                      <Plus data-icon='inline-start' />
                      {t('Add parameter')}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>{t('Request example (JSON body)')}</FieldLabel>
                  <FieldDescription>
                    {requestProblem
                      ? t('Invalid JSON: {{error}}', { error: requestProblem })
                      : t('Leave empty to use the generated example.')}
                  </FieldDescription>
                  <Textarea
                    aria-invalid={Boolean(requestProblem)}
                    className='min-h-32 font-mono text-sm'
                    value={content.request_example}
                    onChange={(event) =>
                      update({ request_example: event.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>{t('Response example (JSON)')}</FieldLabel>
                  <FieldDescription>
                    {responseProblem
                      ? t('Invalid JSON: {{error}}', { error: responseProblem })
                      : t('Leave empty to use the generated example.')}
                  </FieldDescription>
                  <Textarea
                    aria-invalid={Boolean(responseProblem)}
                    className='min-h-32 font-mono text-sm'
                    value={content.response_example}
                    onChange={(event) =>
                      update({ response_example: event.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>
                    {t('Additional information (Markdown)')}
                  </FieldLabel>
                  <Textarea
                    className='min-h-28 font-mono text-sm'
                    value={content.markdown}
                    onChange={(event) =>
                      update({ markdown: event.target.value })
                    }
                  />
                </Field>
              </>
            )}
          </FieldGroup>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3'>
          <Button
            variant='ghost'
            size='sm'
            render={
              <a
                href={`/docs?model=${encodeURIComponent(modelName)}`}
                target='_blank'
                rel='noreferrer'
              />
            }
          >
            <ExternalLink data-icon='inline-start' />
            {t('Open in doc center')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!hasSavedDoc}
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw data-icon='inline-start' />
            {t('Reset to auto-generated')}
          </Button>
          <Button
            size='sm'
            onClick={save}
            disabled={isSaving || docQuery.isLoading}
          >
            <Save data-icon='inline-start' />
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </div>
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title={t('Reset to auto-generated')}
          desc={t(
            'This removes the notes, parameters and examples you added for this model.'
          )}
          confirmText={t('Reset')}
          destructive
          handleConfirm={resetToAuto}
        />
      </SheetContent>
    </Sheet>
  )
}
