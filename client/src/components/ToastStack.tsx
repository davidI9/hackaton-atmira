import { useAppStore } from '../store';

const toastStyles: Record<string, string> = {
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  info: 'border-sky-400/40 bg-sky-500/10 text-sky-100'
};

export function ToastStack() {
  const toasts = useAppStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rounded-2xl border px-4 py-3 shadow-soft backdrop-blur ${toastStyles[toast.type]}`}>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
