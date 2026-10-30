'use client';

import { createContext, useContext, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button, type ButtonProps } from './button';

const CloseCtx = createContext<() => void>(() => {});
// Forms rendered inside a FormDialog call this after saving to dismiss it.
export const useCloseDialog = () => useContext(CloseCtx);

// A button that opens a form in a dialog — keeps "add" forms out of the page until wanted.
export function FormDialog({
  trigger,
  title,
  description,
  children,
  variant = 'outline',
  size = 'sm',
  className,
  open: openProp,
  onOpenChange
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  /** Optional control from the parent, e.g. to close after an action. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = onOpenChange ?? setInner;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <CloseCtx.Provider value={() => setOpen(false)}>{children}</CloseCtx.Provider>
      </DialogContent>
    </Dialog>
  );
}
