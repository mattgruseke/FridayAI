"use client";

import { useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  show: boolean;
  message: string;
  type: ToastType;
};

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const ToastComponent = () => (
    toast.show ? (
      <div className={`toast toast-${toast.type}`}>
        {toast.message}
      </div>
    ) : null
  );

  return { showToast, ToastComponent };
};
