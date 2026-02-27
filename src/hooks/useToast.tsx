"use client";

import { useState, useRef } from 'react';

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
  const lastToastRef = useRef(0);

  const showToast = (message: string, type: ToastType = 'success') => {
    const now = Date.now();
    if (now - lastToastRef.current < 500) return;
    lastToastRef.current = now;
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const toastElement = toast.show ? (
    <div className={`toast toast-${toast.type}`}>
      {toast.message}
    </div>
  ) : null;

  return { showToast, toastElement };
};
