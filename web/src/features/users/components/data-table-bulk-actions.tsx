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
import type { Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'

import { batchDeleteUsers } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { User } from '../types'

const MAX_LISTED_USERNAMES = 10

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions(props: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedUsers = props.table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)
  const listedUsers = selectedUsers.slice(0, MAX_LISTED_USERNAMES)
  const hiddenCount = selectedUsers.length - listedUsers.length

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await batchDeleteUsers(selectedUsers.map((u) => u.id))
      if (!result.success || !result.data) {
        toast.error(result.message || t(ERROR_MESSAGES.DELETE_FAILED))
        return
      }

      const { deleted, failed } = result.data
      if (failed.length === 0) {
        toast.success(t('Deleted {{count}} user(s)', { count: deleted }))
      } else if (deleted === 0) {
        toast.error(
          t('Failed to delete {{failed}} user(s): {{message}}', {
            failed: failed.length,
            message: failed[0].message,
          })
        )
      } else {
        toast.warning(
          t(
            'Deleted {{deleted}} user(s), {{failed}} failed. First error: {{message}}',
            { deleted, failed: failed.length, message: failed[0].message }
          )
        )
      }

      setConfirmOpen(false)
      props.table.resetRowSelection()
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={props.table} entityName='user'>
        <Button
          variant='destructive'
          size='sm'
          onClick={() => setConfirmOpen(true)}
          aria-label={t('Delete selected')}
        >
          <Trash2 aria-hidden='true' />
          {t('Delete selected')}
        </Button>
      </BulkActionsToolbar>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !isDeleting && setConfirmOpen(open)}
        title={t('Delete selected users?')}
        desc={
          <div className='space-y-2'>
            <p>
              {t(
                'This will permanently delete {{count}} user(s). This action cannot be undone.',
                { count: selectedUsers.length }
              )}
            </p>
            <ul className='list-disc ps-5'>
              {listedUsers.map((user) => (
                <li key={user.id} className='font-semibold break-all'>
                  {user.username}
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <p>{t('and {{count}} more', { count: hiddenCount })}</p>
            )}
          </div>
        }
        confirmText={isDeleting ? t('Deleting...') : t('Delete')}
        destructive
        isLoading={isDeleting}
        handleConfirm={handleDelete}
      />
    </>
  )
}
