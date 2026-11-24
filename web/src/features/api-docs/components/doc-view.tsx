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
import { Copy, Download, Info, ListTree, Network } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  docToMarkdown,
  type ResolvedDoc,
  type ResolvedEndpoint,
} from '../lib/build-doc'
import { DOC_CATEGORY_LABELS } from '../lib/templates'

function MethodBadge(props: { method: string }) {
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-xs font-bold',
        props.method === 'GET'
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      {props.method}
    </span>
  )
}

function SectionCard(props: {
  icon: typeof Info
  title: string
  children: ReactNode
  className?: string
}) {
  const Icon = props.icon
  return (
    <section className={cn('bg-card rounded-xl border', props.className)}>
      <h2 className='bg-muted/40 flex items-center gap-2 border-b px-5 py-3 text-base font-semibold'>
        <Icon className='text-primary size-4' />
        {props.title}
      </h2>
      <div className='px-5 py-4'>{props.children}</div>
    </section>
  )
}

function ParamsTable(props: { endpoint: ResolvedEndpoint }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full text-sm'>
        <thead className='bg-muted/40 text-muted-foreground text-left'>
          <tr>
            <th className='px-3 py-2 font-medium'>{t('Parameter')}</th>
            <th className='px-3 py-2 font-medium'>{t('Type')}</th>
            <th className='px-3 py-2 font-medium'>{t('Required')}</th>
            <th className='px-3 py-2 font-medium'>{t('Description')}</th>
          </tr>
        </thead>
        <tbody>
          {props.endpoint.params.map((param) => (
            <tr key={param.name} className='border-t align-top'>
              <td className='px-3 py-2'>
                <code className='bg-muted rounded px-1.5 py-0.5 font-mono text-[13px] font-semibold'>
                  {param.name}
                </code>
              </td>
              <td className='text-muted-foreground px-3 py-2 font-mono text-xs whitespace-nowrap'>
                {param.type}
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                {param.required ? (
                  <Badge variant='destructive'>{t('Yes')}</Badge>
                ) : (
                  <span className='text-muted-foreground'>{t('No')}</span>
                )}
              </td>
              <td className='px-3 py-2 leading-relaxed'>{param.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointSection(props: { endpoint: ResolvedEndpoint }) {
  const { t } = useTranslation()
  const { endpoint } = props
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <h2 className='text-lg font-semibold'>{endpoint.title}</h2>
        <code className='bg-muted flex items-center gap-2 rounded-md px-2 py-1 font-mono text-xs'>
          <MethodBadge method={endpoint.method} />
          {endpoint.path}
        </code>
      </div>
      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>{t('Request parameters')}</h3>
        <ParamsTable endpoint={endpoint} />
      </div>
      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>{t('Request example')}</h3>
        <CodeBlock code={endpoint.curl} language='bash' enableCollapse={false}>
          <CodeBlockCopyButton />
        </CodeBlock>
      </div>
      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>{t('Response example')}</h3>
        <CodeBlock code={endpoint.responseJson} language='json'>
          <CodeBlockCopyButton />
        </CodeBlock>
      </div>
      {endpoint.followUps.map((followUp) => (
        <div key={followUp.path} className='space-y-2'>
          <h3 className='flex flex-wrap items-center gap-2 text-sm font-semibold'>
            {followUp.summary}
            <code className='bg-muted flex items-center gap-2 rounded-md px-2 py-0.5 font-mono text-xs font-normal'>
              <MethodBadge method={followUp.method} />
              {followUp.path}
            </code>
          </h3>
          <CodeBlock
            code={followUp.curl}
            language='bash'
            enableCollapse={false}
          >
            <CodeBlockCopyButton />
          </CodeBlock>
          {followUp.responseJson && (
            <CodeBlock code={followUp.responseJson} language='json'>
              <CodeBlockCopyButton />
            </CodeBlock>
          )}
        </div>
      ))}
    </section>
  )
}

export function DocView(props: {
  doc: ResolvedDoc
  icon?: string
  vendorName?: string
}) {
  const { t } = useTranslation()
  const { doc } = props
  const icon = props.icon ? getLobeIcon(props.icon, 32) : null
  const notes = [...doc.notes, ...doc.endpoints.flatMap((e) => e.notes)]

  const copyMarkdown = async () => {
    const ok = await copyToClipboard(docToMarkdown(doc, t))
    if (ok) toast.success(t('Doc copied as Markdown'))
    else toast.error(t('Copy failed'))
  }

  const downloadMarkdown = () => {
    const blob = new Blob([docToMarkdown(doc, t)], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${doc.modelName}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <article className='space-y-6'>
      <header className='flex flex-wrap items-start gap-4 border-b pb-6'>
        <div className='bg-card flex size-14 shrink-0 items-center justify-center rounded-xl border text-xl font-bold'>
          {icon ?? doc.modelName.charAt(0).toUpperCase()}
        </div>
        <div className='min-w-0 flex-1'>
          <h1 className='font-mono text-2xl font-bold break-all sm:text-3xl'>
            {doc.modelName}
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            {doc.summary ||
              [props.vendorName, t(DOC_CATEGORY_LABELS[doc.category])]
                .filter(Boolean)
                .join(' · ')}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={copyMarkdown}>
            <Copy data-icon='inline-start' />
            {t('Copy doc')}
          </Button>
          <Button variant='outline' size='sm' onClick={downloadMarkdown}>
            <Download data-icon='inline-start' />
            {t('Download doc')}
          </Button>
        </div>
      </header>

      {doc.mode === 'custom' ? (
        <Markdown className='max-w-none'>{doc.markdown}</Markdown>
      ) : (
        <>
          <div className='grid gap-4 lg:grid-cols-2'>
            <SectionCard icon={Network} title={t('Endpoints')}>
              <ul className='divide-y'>
                {doc.endpoints.map((endpoint) => (
                  <li key={endpoint.type} className='py-2 first:pt-0 last:pb-0'>
                    <EndpointLine
                      method={endpoint.method}
                      path={endpoint.path}
                      label={endpoint.title}
                    />
                    {endpoint.followUps.map((followUp) => (
                      <EndpointLine
                        key={followUp.path}
                        method={followUp.method}
                        path={followUp.path}
                        label={followUp.summary}
                        className='mt-2'
                      />
                    ))}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard icon={Info} title={t('Notes')}>
              {notes.length > 0 ? (
                <ul className='list-disc space-y-1.5 pl-5 text-sm leading-relaxed'>
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className='text-muted-foreground text-sm'>
                  {t('No special notes for this model.')}
                </p>
              )}
            </SectionCard>
          </div>
          {doc.endpoints.map((endpoint) => (
            <EndpointSection key={endpoint.type} endpoint={endpoint} />
          ))}
          {doc.markdown.trim() && (
            <SectionCard icon={ListTree} title={t('Additional information')}>
              <Markdown className='max-w-none'>{doc.markdown}</Markdown>
            </SectionCard>
          )}
        </>
      )}
    </article>
  )
}

function EndpointLine(props: {
  method: string
  path: string
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const copyPath = async () => {
    if (await copyToClipboard(props.path)) toast.success(t('Copied'))
  }
  return (
    <div className={cn('flex items-start gap-2', props.className)}>
      <MethodBadge method={props.method} />
      <div className='min-w-0 flex-1'>
        <button
          type='button'
          onClick={copyPath}
          title={t('Copy')}
          className='text-primary hover:bg-muted rounded px-1 text-left font-mono text-sm break-all'
        >
          {props.path}
        </button>
        <div className='text-muted-foreground px-1 text-xs'>{props.label}</div>
      </div>
    </div>
  )
}
