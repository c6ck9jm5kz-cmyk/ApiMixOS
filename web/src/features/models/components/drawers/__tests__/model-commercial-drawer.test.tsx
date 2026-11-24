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
import assert from 'node:assert/strict'
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'PointerEvent',
  'MouseEvent',
  'FocusEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ModelCommercialDrawer } = await import('../model-commercial-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
  put: ApiMethod
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPut = apiClient.put
let root: ReturnType<typeof createRoot> | null = null
let queryClient: InstanceType<typeof QueryClient> | null = null

function findButton(text: string): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.includes(text))
  assert.ok(button, `Expected button containing "${text}"`)
  return button
}

async function waitForCondition(
  condition: () => boolean,
  failureMessage: string
): Promise<void> {
  if (condition()) return

  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!condition()) return
      clearTimeout(timeoutId)
      observer.disconnect()
      resolve()
    })
    const timeoutId = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`${failureMessage}: ${document.body.textContent}`))
    }, 1500)

    observer.observe(document, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
}

function changeInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    domWindow.HTMLInputElement.prototype,
    'value'
  )?.set
  assert.ok(valueSetter)
  valueSetter.call(input, value)
  input.dispatchEvent(
    new domWindow.Event('input', { bubbles: true }) as unknown as Event
  )
}

afterEach(async () => {
  apiClient.get = originalGet
  apiClient.put = originalPut
  if (root) await act(async () => root?.unmount())
  queryClient?.clear()
  root = null
  queryClient = null
  document.body.replaceChildren()
})

after(() => domWindow.close())

describe('model commercial drawer upstream settings', () => {
  test('saves the selected channel upstream model and inherited cost together', async () => {
    const requests: Array<{ url: string; data: unknown }> = []
    const optionsResponse = {
      success: true,
      data: [
        {
          key: 'ModelCost',
          value: JSON.stringify({
            'public-model': {
              currency: 'USD',
              enabled: true,
              input_per_1m: 3,
              output_per_1m: 15,
            },
          }),
        },
      ],
    }
    apiClient.get = async (url) => {
      assert.equal(url, '/api/option/')
      return { data: optionsResponse }
    }
    apiClient.put = async (url, data) => {
      requests.push({ url, data })
      return { data: { success: true } }
    }

    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient = testQueryClient
    testQueryClient.setQueryData(['system-options'], optionsResponse, {
      updatedAt: Date.now() + 60_000,
    })

    await act(async () => {
      root?.render(
        <QueryClientProvider client={testQueryClient}>
          <I18nextProvider i18n={i18n}>
            <ModelCommercialDrawer
              open
              onOpenChange={() => undefined}
              model={{
                id: 42,
                model_name: 'public-model',
                model_type: 'text',
                status: 1,
                sync_official: 0,
                created_time: 1,
                updated_time: 1,
                name_rule: 0,
                bound_channels: [
                  {
                    id: 7,
                    name: 'Primary channel',
                    type: 1,
                    upstream_model: 'provider-model-v1',
                  },
                ],
              }}
            />
          </I18nextProvider>
        </QueryClientProvider>
      )
    })

    await act(async () => findButton('Upstream Cost').click())
    const scopeTrigger = document.querySelector<HTMLButtonElement>(
      '[data-slot="select-trigger"]'
    )
    assert.ok(scopeTrigger)
    await act(async () => scopeTrigger.click())
    const channelOption = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
    ].find((item) => item.textContent?.includes('Primary channel'))
    assert.ok(channelOption)
    await act(async () => channelOption.click())

    await waitForCondition(
      () => document.body.textContent?.includes('Upstream model') === true,
      'Upstream model field did not appear'
    )
    const upstreamLabel = [
      ...document.querySelectorAll<HTMLLabelElement>('label'),
    ].find((label) => label.textContent?.trim() === 'Upstream model')
    assert.ok(upstreamLabel)
    const upstreamInput = upstreamLabel
      .closest('[data-slot="field"]')
      ?.querySelector<HTMLInputElement>('input')
    assert.ok(upstreamInput)
    assert.equal(upstreamInput.value, 'provider-model-v1')

    await act(async () => changeInput(upstreamInput, 'provider-model-v2'))
    await act(async () => findButton('Save upstream settings').click())
    await waitForCondition(
      () => requests.length === 1,
      'Commercial settings request was not sent'
    )

    assert.equal(requests[0].url, '/api/models/42/commercial-config')
    assert.deepEqual(requests[0].data, {
      channel_id: 7,
      upstream_model: 'provider-model-v2',
      cost: {
        currency: 'USD',
        enabled: true,
        input_per_1m: 3,
        output_per_1m: 15,
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
      },
    })
  })

  test('accepts decimals typed one keystroke at a time', async () => {
    const requests: Array<{ url: string; data: unknown }> = []
    const optionsResponse = {
      success: true,
      data: [{ key: 'ModelCost', value: '{}' }],
    }
    apiClient.get = async () => ({ data: optionsResponse })
    apiClient.put = async (url, data) => {
      requests.push({ url, data })
      return { data: { success: true } }
    }

    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient = testQueryClient
    testQueryClient.setQueryData(['system-options'], optionsResponse, {
      updatedAt: Date.now() + 60_000,
    })

    await act(async () => {
      root?.render(
        <QueryClientProvider client={testQueryClient}>
          <I18nextProvider i18n={i18n}>
            <ModelCommercialDrawer
              open
              onOpenChange={() => undefined}
              model={{
                id: 9,
                model_name: 'decimal-model',
                model_type: 'text',
                status: 1,
                sync_official: 0,
                created_time: 1,
                updated_time: 1,
                name_rule: 0,
                bound_channels: [],
              }}
            />
          </I18nextProvider>
        </QueryClientProvider>
      )
    })

    await act(async () => findButton('Upstream Cost').click())
    await waitForCondition(
      () => document.querySelector('input[aria-label="Input"]') !== null,
      'Input cost field did not appear'
    )
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Input"]'
    )
    assert.ok(input)

    for (const text of ['', '0', '0.', '0.7', '0.75']) {
      await act(async () => changeInput(input, text))
      assert.equal(input.value, text, `box should keep "${text}"`)
    }

    await act(async () => findButton('Save upstream settings').click())
    await waitForCondition(
      () => requests.length === 1,
      'Commercial settings request was not sent'
    )
    const body = requests[0].data as { cost: { input_per_1m: number } }
    assert.equal(body.cost.input_per_1m, 0.75)
  })
})
