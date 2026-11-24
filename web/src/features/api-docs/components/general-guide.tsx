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
import { KeyRound, RefreshCcw, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'

import { API_KEY_PLACEHOLDER } from '../lib/build-doc'

function GuideSection(props: {
  icon: typeof KeyRound
  title: string
  children: ReactNode
}) {
  const Icon = props.icon
  return (
    <section className='space-y-3'>
      <h2 className='flex items-center gap-2 text-lg font-semibold'>
        <span className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg'>
          <Icon className='size-4' />
        </span>
        {props.title}
      </h2>
      <div className='space-y-3 text-sm leading-relaxed'>{props.children}</div>
    </section>
  )
}

export function GeneralGuide(props: { baseUrl: string; modelCount: number }) {
  const { t } = useTranslation()
  const headers = [
    `Authorization: Bearer ${API_KEY_PLACEHOLDER}`,
    'Content-Type: application/json',
  ].join('\n')
  const errors: Array<[string, string]> = [
    ['400', t('The request is invalid; check the parameters.')],
    ['401', t('The API key is missing, wrong or disabled.')],
    ['403', t('The key or group may not use this model.')],
    [
      '429',
      t('Too many requests or insufficient balance; slow down or top up.'),
    ],
    ['5xx', t('Upstream or gateway error; retry later.')],
  ]
  return (
    <article className='space-y-8'>
      <header className='border-b pb-6'>
        <h1 className='text-2xl font-bold sm:text-3xl'>
          {t('Getting started')}
        </h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          {t(
            'One API key for all {{count}} models. Pick a model on the left to see its endpoint, parameters and examples.',
            { count: props.modelCount }
          )}
        </p>
      </header>

      <GuideSection icon={KeyRound} title={t('Authentication')}>
        <p>
          {t(
            'Create an API key in the console, then send it in the Authorization header with every request.'
          )}
        </p>
        <p>
          {t('Base URL')}:{' '}
          <code className='bg-muted rounded px-1.5 py-0.5 font-mono'>
            {props.baseUrl}
          </code>
        </p>
        <CodeBlock code={headers} language='http' enableCollapse={false}>
          <CodeBlockCopyButton />
        </CodeBlock>
        <div className='border-warning/40 bg-warning/10 flex gap-2 rounded-lg border px-3 py-2'>
          <ShieldAlert className='text-warning mt-0.5 size-4 shrink-0' />
          <span>
            {t(
              'Never put your API key in browser or app code that users can see; call the API from your own server.'
            )}
          </span>
        </div>
      </GuideSection>

      <GuideSection icon={RefreshCcw} title={t('Asynchronous tasks')}>
        <p>
          {t(
            'Video and some image models run as tasks. The create request returns a task ID right away; poll the query endpoint until the status is completed or failed, then fetch the result.'
          )}
        </p>
        <ol className='list-decimal space-y-1 pl-5'>
          <li>{t('Create the task and save the returned ID.')}</li>
          <li>{t('Query the task every 5 to 10 seconds.')}</li>
          <li>{t('When it is completed, download the result.')}</li>
        </ol>
      </GuideSection>

      <GuideSection icon={TriangleAlert} title={t('Errors')}>
        <div className='overflow-x-auto rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/40 text-muted-foreground text-left'>
              <tr>
                <th className='px-3 py-2 font-medium'>{t('HTTP status')}</th>
                <th className='px-3 py-2 font-medium'>{t('Meaning')}</th>
              </tr>
            </thead>
            <tbody>
              {errors.map(([code, meaning]) => (
                <tr key={code} className='border-t'>
                  <td className='px-3 py-2 font-mono'>{code}</td>
                  <td className='px-3 py-2'>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='text-muted-foreground'>
          {t(
            'Error responses include an error object with a message explaining what went wrong.'
          )}
        </p>
      </GuideSection>
    </article>
  )
}
