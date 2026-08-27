/**
 * The handful of Material Symbols we need, inlined as SVG paths.
 *
 * Inlined rather than loaded from the Material Symbols icon font on purpose:
 * the font is roughly 200KB and would be a request to Google on every page
 * load. These are the official 24px Material Symbols outlines.
 */

type IconProps = { className?: string };

function svgProps(className?: string) {
  return {
    viewBox: "0 -960 960 960",
    fill: "currentColor",
    "aria-hidden": true,
    className: className ?? "size-6",
  } as const;
}

export function AddIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z" />
    </svg>
  );
}

export function InventoryIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M200-80q-33 0-56.5-23.5T120-160v-451q-18-11-29-28.5T80-680v-120q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v120q0 23-11 40.5T840-611v451q0 33-23.5 56.5T760-80H200Zm0-520v440h560v-440H200Zm600-80v-120H160v120h640ZM360-400h240v-80H360v80ZM480-380Z" />
    </svg>
  );
}

export function ErrorIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
    </svg>
  );
}

export function OpenInNewIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M480-80q0-83-31.5-156T363-363q-54-54-127-85.5T80-480q83 0 156-31.5T363-597q54-54 85.5-127T480-880q0 83 31.5 156T597-597q54 54 127 85.5T880-480q-83 0-156 31.5T597-363q-54 54-85.5 127T480-80Z" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v145l240 55-240 55v145Zm0 0v-400 400Z" />
    </svg>
  );
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
    </svg>
  );
}
