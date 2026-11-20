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
  const lastToastRef = useRef({ message: '', at: 0 });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    const now = Date.now();
    // Only an identical message is a duplicate; a different one still needs seeing.
    if (message === lastToastRef.current.message && now - lastToastRef.current.at < 500) return;
    lastToastRef.current = { message, at: now };
    setToast({ show: true, message, type });
    // Restart the timer so an earlier toast's timer can't hide this one early.
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
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
