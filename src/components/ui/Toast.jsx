import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

const silentToast = { success: () => {}, error: () => {}, dismiss: () => {} };
const ToastContext = createContext(silentToast);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, type }]);
    window.setTimeout(() => dismiss(id), type === 'error' ? 6500 : 4000);
    return id;
  }, [dismiss]);
  const value = useMemo(() => ({
    success: (message) => notify(message, 'success'),
    error: (message) => notify(message, 'error'),
    dismiss,
  }), [dismiss, notify]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {items.map((item) => <div className={`app-toast ${item.type}`} role={item.type === 'error' ? 'alert' : 'status'} key={item.id}>
        {item.type === 'error' ? <CircleAlert /> : <CheckCircle2 />}
        <span>{item.message}</span>
        <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"><X /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}
