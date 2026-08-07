import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, title, description, children, className = '', preventClose = false }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className={`dialog-content ${className}`} onEscapeKeyDown={(event) => preventClose && event.preventDefault()} onPointerDownOutside={(event) => preventClose && event.preventDefault()}>
        <div className="dialog-heading"><div><DialogPrimitive.Title>{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description>{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close disabled={preventClose} className="icon-button" aria-label="Close"><X size={18} /></DialogPrimitive.Close></div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
