/**
 * Material 3 linear progress indicator.
 *
 * A 4px track with a rounded active bar. M3 also puts a small gap between the
 * bar and the remaining track; that is skipped here because it needs a second
 * element for what is a purely decorative detail.
 *
 * Always determinate: this is used for file uploads, where the browser knows
 * how many bytes have gone, and a real percentage is far more reassuring than
 * a spinner when someone is waiting on a large file.
 */

export interface LinearProgressProps {
  /** 0 to 100. */
  value: number;
  label?: string;
}

export function LinearProgress({ value, label }: LinearProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-body-small text-on-surface-variant">{label}</span>
          <span className="text-label-medium text-on-surface-variant tabular-nums">
            {Math.round(clamped)}%
          </span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Upload progress"}
        className="h-1 w-full overflow-hidden rounded-full bg-secondary-container"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[--md-sys-motion-duration-medium] ease-standard"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
