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
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  defaultBillingSettings,
  getGroupDefaults,
  getModelDefaults,
} from '@/features/system-settings/billing/defaults'
import { SettingsPageProvider } from '@/features/system-settings/components/settings-page-context'
import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import { ModelCostSection } from '@/features/system-settings/models/model-cost-section'
import { RatioSettingsCard } from '@/features/system-settings/models/ratio-settings-card'
import type { BillingSettings } from '@/features/system-settings/types'

import { listDeployments } from './api'
import { DeploymentAccessGuard } from './components/deployment-access-guard'
import { DeploymentsTable } from './components/deployments-table'
import { CreateDeploymentDrawer } from './components/dialogs/create-deployment-drawer'
import { ModelsDialogs } from './components/models-dialogs'
import { ModelsPrimaryButtons } from './components/models-primary-buttons'
import { ModelsProvider, useModels } from './components/models-provider'
import { ModelsTable } from './components/models-table'
import { useModelDeploymentSettings } from './hooks/use-model-deployment-settings'
import { deploymentsQueryKeys } from './lib'
import {
  type ModelsSectionId,
  MODELS_DEFAULT_SECTION,
  MODELS_SECTION_IDS,
} from './section-registry'

const route = getRouteApi('/_authenticated/models/$section')

const SECTION_META: Record<ModelsSectionId, { titleKey: string }> = {
  metadata: {
    titleKey: 'Metadata',
  },
  deployments: {
    titleKey: 'Deployments',
  },
  costs: {
    titleKey: 'Upstream Model Costs',
  },
  groups: {
    titleKey: 'Group Management',
  },
}

function ModelsContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tabCategory, setTabCategory } = useModels()
  const params = route.useParams()
  const activeSection = (params.section ??
    MODELS_DEFAULT_SECTION) as ModelsSectionId

  // Deployment create dialog state
  const [createDeploymentOpen, setCreateDeploymentOpen] = useState(false)
  // Settings editors (group ratios) portal their save button into this slot
  const [settingsActions, setSettingsActions] = useState<HTMLDivElement | null>(
    null
  )

  // keep context state in sync (for components that rely on it)
  useEffect(() => {
    if (tabCategory !== activeSection) {
      setTabCategory(activeSection)
    }
  }, [activeSection, setTabCategory, tabCategory])

  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/models/$section',
        params: { section: section as ModelsSectionId },
      })
    },
    [navigate]
  )

  const meta = SECTION_META[activeSection] ?? SECTION_META.metadata
  let actions: ReactNode = null
  if (activeSection === 'metadata') {
    actions = <ModelsPrimaryButtons />
  } else if (activeSection === 'deployments') {
    actions = (
      <Button onClick={() => setCreateDeploymentOpen(true)} size='sm'>
        <Plus className='h-4 w-4' />
        {t('Create deployment')}
      </Button>
    )
  } else if (activeSection === 'groups') {
    actions = (
      <div
        ref={setSettingsActions}
        className='flex flex-wrap items-center justify-end gap-2'
      />
    )
  }

  let sectionContent: ReactNode
  if (activeSection === 'metadata') {
    sectionContent = <ModelsTable />
  } else if (activeSection === 'deployments') {
    sectionContent = <DeploymentsSection />
  } else if (activeSection === 'groups') {
    sectionContent = (
      <SettingsPageProvider actionsContainer={settingsActions}>
        <ModelGroupsSection />
      </SettingsPageProvider>
    )
  } else {
    sectionContent = <ModelCostsSection />
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>{actions}</SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-4'>
            <Tabs value={activeSection} onValueChange={handleSectionChange}>
              <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                {MODELS_SECTION_IDS.map((section) => (
                  <TabsTrigger key={section} value={section}>
                    {t(SECTION_META[section].titleKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className='min-h-0 flex-1'>{sectionContent}</div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ModelsDialogs />
      <CreateDeploymentDrawer
        open={createDeploymentOpen}
        onOpenChange={setCreateDeploymentOpen}
      />
    </>
  )
}

function ModelCostsSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const defaultValue =
    data?.data?.find((option) => option.key === 'ModelCost')?.value ?? '{}'

  if (isLoading) {
    return (
      <div className='text-muted-foreground flex min-h-40 items-center justify-center text-sm'>
        {t('Loading settings...')}
      </div>
    )
  }

  return <ModelCostSection defaultValue={defaultValue} />
}

function ModelGroupsSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const settings = useMemo(
    () => getOptionValue(data?.data, defaultBillingSettings) as BillingSettings,
    [data?.data]
  )
  if (isLoading) {
    return (
      <div className='text-muted-foreground flex min-h-40 items-center justify-center text-sm'>
        {t('Loading settings...')}
      </div>
    )
  }
  // Same editor and same stored options as System Settings → Billing →
  // Group Pricing, surfaced next to the model catalog for convenience.
  return (
    <div className='h-full overflow-y-auto pb-6'>
      <RatioSettingsCard
        titleKey='Group Management'
        modelDefaults={getModelDefaults(settings)}
        groupDefaults={getGroupDefaults(settings)}
        toolPricesDefault={settings['tool_price_setting.prices']}
        visibleTabs={['groups']}
      />
    </div>
  )
}

function DeploymentsSection() {
  const queryClient = useQueryClient()
  const {
    loading: deploymentLoading,
    loadingPhase,
    isIoNetEnabled,
    connectionLoading,
    connectionOk,
    connectionError,
    testConnection,
  } = useModelDeploymentSettings()

  // Prefetch deployments list while connection check is in progress.
  useEffect(() => {
    if (isIoNetEnabled && loadingPhase === 'connection') {
      const defaultParams = { p: 1, page_size: 10 }
      queryClient.prefetchQuery({
        queryKey: deploymentsQueryKeys.list(defaultParams),
        queryFn: () => listDeployments(defaultParams),
        staleTime: 30 * 1000,
      })
    }
  }, [isIoNetEnabled, loadingPhase, queryClient])

  return (
    <DeploymentAccessGuard
      loading={deploymentLoading}
      loadingPhase={loadingPhase}
      isEnabled={isIoNetEnabled}
      connectionLoading={connectionLoading}
      connectionOk={connectionOk}
      connectionError={connectionError}
      onRetry={testConnection}
    >
      <DeploymentsTable />
    </DeploymentAccessGuard>
  )
}

export function Models() {
  return (
    <ModelsProvider>
      <ModelsContent />
    </ModelsProvider>
  )
}
