import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function Dialog({ open, onOpenChange, title, description, children, className = '', preventClose = false }) {
  const scrollPosition = useRef(0);
  const wasOpen = useRef(false);
  const returnFocus = useRef(null);
  if (open && !wasOpen.current && typeof document !== 'undefined') returnFocus.current = document.activeElement;
  useEffect(() => { wasOpen.current = open; }, [open]);
  useEffect(() => {
    if (!open || !window.visualViewport) return undefined;
    const viewport = window.visualViewport;
    scrollPosition.current = window.scrollY;
    const syncViewport = () => {
      document.documentElement.style.setProperty('--dialog-viewport-height', `${viewport.height}px`);
      document.documentElement.style.setProperty('--dialog-viewport-offset', `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      document.documentElement.style.removeProperty('--dialog-viewport-height');
      document.documentElement.style.removeProperty('--dialog-viewport-offset');
      window.scrollTo({ top: scrollPosition.current, behavior: 'instant' });
    };
  }, [open]);
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className={`dialog-content ${className}`} onOpenAutoFocus={() => window.setTimeout(() => document.activeElement?.scrollIntoView?.({ block: 'center' }), 80)} onCloseAutoFocus={(event) => { const target = returnFocus.current; if (target && target !== document.body && target.focus) { event.preventDefault(); window.requestAnimationFrame(() => target.focus()); } }} onEscapeKeyDown={(event) => preventClose && event.preventDefault()} onPointerDownOutside={(event) => preventClose && event.preventDefault()}>
        <div className="dialog-heading"><div><DialogPrimitive.Title>{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description>{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close disabled={preventClose} className="icon-button" aria-label="Close"><X size={18} /></DialogPrimitive.Close></div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
