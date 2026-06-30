'use client'

import React, { useState, useCallback } from 'react'
import { AlertModal, ConfirmModal } from '@/components/ui/dialogs'

export function useCustomDialogs() {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'success' | 'error'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const showAlert = useCallback(
    (message: string, title = 'התראה', type: 'info' | 'success' | 'error' = 'info') => {
      setAlertState({ isOpen: true, title, message, type })
    },
    []
  )

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void, title = 'אישור פעולה') => {
      setConfirmState({ isOpen: true, title, message, onConfirm })
    },
    []
  )

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const CustomDialogs = useCallback(
    () => (
      <>
        <AlertModal
          isOpen={alertState.isOpen}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          onClose={closeAlert}
        />
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={() => {
            confirmState.onConfirm()
            closeConfirm()
          }}
          onClose={closeConfirm}
        />
      </>
    ),
    [alertState, confirmState, closeAlert, closeConfirm]
  )

  return { showAlert, showConfirm, CustomDialogs }
}
