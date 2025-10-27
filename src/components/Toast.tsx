import { useToast } from '../store/useToast';

export default function Toast() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const bgColor =
          toast.type === 'success'
            ? 'bg-green-600'
            : toast.type === 'warning'
            ? 'bg-yellow-600'
            : toast.type === 'error'
            ? 'bg-red-600'
            : 'bg-blue-600';

        return (
          <div
            key={toast.id}
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}
          >
            <div className="flex-1 text-sm">{toast.message}</div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-white hover:text-gray-200 font-bold"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
