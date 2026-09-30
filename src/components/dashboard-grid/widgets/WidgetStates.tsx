export function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-3 w-2/3 rounded bg-neutral-100" />
      <div className="h-3 w-1/2 rounded bg-neutral-100" />
    </div>
  );
}

export function WidgetError({ message }: { message: string }) {
  return <p className="text-xs text-rose-600">{message}</p>;
}

export function WidgetEmpty({ message }: { message: string }) {
  return <p className="text-xs text-neutral-400">{message}</p>;
}
