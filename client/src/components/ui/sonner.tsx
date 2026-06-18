import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm',
        },
      }}
    />
  );
}
