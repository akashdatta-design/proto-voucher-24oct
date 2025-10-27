import { useToast } from '../store/useToast';

export default function Toast() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const styles =
          toast.type === 'success'
            ? 'bg-green-600 dark:bg-green-700 border-l-4 border-green-400'
            : toast.type === 'warning'
            ? 'bg-yellow-600 dark:bg-yellow-700 border-l-4 border-yellow-400'
            : toast.type === 'error'
            ? 'bg-red-600 dark:bg-red-700 border-l-4 border-red-400'
            : 'bg-primary dark:bg-primary-dark border-l-4 border-primary';

        return (
          <div
            key={toast.id}
            className={`${styles} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}
          >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-white hover:text-gray-200 font-bold text-xl leading-none"
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
