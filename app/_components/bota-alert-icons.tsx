/**
 * BOTA Branded Alert Icons
 * ─────────────────────────────────────────────────────────────────
 * All 7 icons from BOTA NEW BRAND ASSETS / ICONS / ALERTS.
 * Each export is an Ant Design–compatible React icon component
 * (accepts `style`, `className`, `width`, `height`).
 *
 * Usage with Ant Design Alert:
 *   import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";
 *   <Alert type="error" showIcon icon={<BotaFailureIcon />} message="..." />
 *
 * Usage standalone:
 *   <BotaRejectedIcon width={20} height={20} />
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  /** Uniform size shorthand — overrides both width and height */
  size?: number;
};

function resolveSize(props: IconProps, defaultW: number, defaultH: number) {
  const { size, width, height, ...rest } = props;
  return {
    width: size ?? width ?? defaultW,
    height: size ?? height ?? defaultH,
    ...rest,
  };
}

// ─── 1. Make Correction ──────────────────────────────────────────
// Triangle warning, golden yellow #e6bf04 — use for validation hints
export function BotaMakeCorrectionIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 18, 16);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18.33 16.29"
      width={width}
      height={height}
      aria-label="Make correction"
      {...rest}
    >
      <path
        fill="#e6bf04"
        d="M18.19,14.76,10.05.5A1,1,0,0,0,9.16,0a1,1,0,0,0-.87.5L.14,14.76a1,1,0,0,0,0,1,1,1,0,0,0,.89.51H17.31a1,1,0,0,0,.88-1.53ZM10.13,5.09,9.92,11.2H8.41L8.19,5.09Zm0,8.6a1,1,0,0,1-.2.3,1.08,1.08,0,0,1-.33.2,1.32,1.32,0,0,1-.42.07,1.42,1.42,0,0,1-.42-.07,1.16,1.16,0,0,1-.32-.2,1.21,1.21,0,0,1-.2-.3,1.07,1.07,0,0,1,0-.76,1.21,1.21,0,0,1,.2-.3,1,1,0,0,1,.32-.2,1.16,1.16,0,0,1,.42-.07,1.09,1.09,0,0,1,.42.07.91.91,0,0,1,.33.2,1,1,0,0,1,.2.3,1.07,1.07,0,0,1,0,.76Z"
      />
    </svg>
  );
}

// ─── 2. Necessary Attention ──────────────────────────────────────
// Triangle warning, light yellow #ffe981 — soft/informational warning
export function BotaNecessaryAttentionIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 20, 18);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 39.93 35.49"
      width={width}
      height={height}
      aria-label="Necessary attention"
      {...rest}
    >
      <path
        fill="#ffe981"
        d="M39.63,32.16,21.88,1.1a2.22,2.22,0,0,0-3.83,0L.3,32.16a2.21,2.21,0,0,0,1.92,3.33H37.71a2.21,2.21,0,0,0,1.92-3.33ZM22.07,11.09,21.61,24.4h-3.3l-.47-13.31ZM22,29.82a1.9,1.9,0,0,1-1.14,1.08,2.47,2.47,0,0,1-.92.16A2.43,2.43,0,0,1,19,30.9a2.12,2.12,0,0,1-.69-.43,1.92,1.92,0,0,1-.44-.65,2,2,0,0,1-.17-.82,2.05,2.05,0,0,1,.17-.83A1.9,1.9,0,0,1,19,27.08a2.43,2.43,0,0,1,.92-.16,2.47,2.47,0,0,1,.92.16,1.92,1.92,0,0,1,.7.43,2,2,0,0,1,.44.66,2.05,2.05,0,0,1,.17.83A2,2,0,0,1,22,29.82Z"
      />
    </svg>
  );
}

// ─── 3. Critical Alerts ──────────────────────────────────────────
// Triangle warning, dark red #a51221 — highest severity errors
export function BotaCriticalAlertIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 18, 16);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18.33 16.29"
      width={width}
      height={height}
      aria-label="Critical alert"
      {...rest}
    >
      <path
        fill="#a51221"
        d="M18.19,14.76,10.05.5A1,1,0,0,0,9.16,0a1,1,0,0,0-.87.5L.14,14.76a1,1,0,0,0,0,1,1,1,0,0,0,.89.51H17.31a1,1,0,0,0,.88-1.53ZM10.13,5.09,9.92,11.2H8.41L8.19,5.09Zm0,8.6a1,1,0,0,1-.2.3,1.08,1.08,0,0,1-.33.2,1.32,1.32,0,0,1-.42.07,1.42,1.42,0,0,1-.42-.07,1.16,1.16,0,0,1-.32-.2,1.21,1.21,0,0,1-.2-.3,1.07,1.07,0,0,1,0-.76,1.21,1.21,0,0,1,.2-.3,1,1,0,0,1,.32-.2,1.16,1.16,0,0,1,.42-.07,1.09,1.09,0,0,1,.42.07.91.91,0,0,1,.33.2,1,1,0,0,1,.2.3,1.07,1.07,0,0,1,0,.76Z"
      />
    </svg>
  );
}

// ─── 4. Failure ──────────────────────────────────────────────────
// Triangle warning, BOTA red #ea3e4f — standard error/failure state
export function BotaFailureIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 20, 18);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 38.14 33.9"
      width={width}
      height={height}
      aria-label="Failure"
      {...rest}
    >
      <path
        fill="#ea3e4f"
        d="M37.85,30.71,20.9,1.05a2.12,2.12,0,0,0-3.66,0L.29,30.71a2.09,2.09,0,0,0,0,2.12A2.13,2.13,0,0,0,2.12,33.9H36a2.13,2.13,0,0,0,1.83-3.19ZM21.08,10.59l-.44,12.72H17.49L17,10.59Zm0,17.89a1.81,1.81,0,0,1-1.09,1,2.42,2.42,0,0,1-.88.15,2.37,2.37,0,0,1-.87-.15,2,2,0,0,1-.66-.41,1.77,1.77,0,0,1-.43-.62,2,2,0,0,1-.15-.79,2.09,2.09,0,0,1,.15-.79,1.69,1.69,0,0,1,.43-.62,1.74,1.74,0,0,1,.66-.42,2.37,2.37,0,0,1,.87-.15,2.42,2.42,0,0,1,.88.15,1.87,1.87,0,0,1,1.09,1,1.92,1.92,0,0,1,.16.79A1.86,1.86,0,0,1,21,28.48Z"
      />
    </svg>
  );
}

// ─── 5. Not Allowed ──────────────────────────────────────────────
// Rounded square + X, gold — forbidden / access-denied states
export function BotaNotAllowedIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 18, 18);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 34.89 34.89"
      width={width}
      height={height}
      aria-label="Not allowed"
      {...rest}
    >
      <path
        fill="gold"
        d="M30.69,0H4.2A4.19,4.19,0,0,0,0,4.2V30.7a4.18,4.18,0,0,0,4.2,4.19H30.69a4.18,4.18,0,0,0,4.2-4.19V4.2A4.19,4.19,0,0,0,30.69,0ZM27.12,30H25.34a.88.88,0,0,1-.74-.4l-7-10.26L10.1,29.65a.9.9,0,0,1-.72.37H7.77A.91.91,0,0,1,7,28.58l8.12-11.14a.86.86,0,0,1,.25-.22L7.47,6.32A.91.91,0,0,1,8.2,4.88H10a.94.94,0,0,1,.73.37l6.86,9.51,6.72-9.5a.89.89,0,0,1,.73-.38h1.62a.91.91,0,0,1,.74,1.43L19.79,17,27.86,28.6A.9.9,0,0,1,27.12,30Z"
      />
    </svg>
  );
}

// ─── 6. Rejected ─────────────────────────────────────────────────
// Red circle + white X — rejected/denied result (e.g. form submit)
export function BotaRejectedIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 18, 18);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 35.76 35.76"
      width={width}
      height={height}
      aria-label="Rejected"
      {...rest}
    >
      <circle fill="#ea3e4f" cx="17.88" cy="17.88" r="17.88" />
      <path
        fill="#fff"
        d="M26.88,29.56H25.22a.83.83,0,0,1-.69-.36L18,19.66l-6.94,9.56a.84.84,0,0,1-.67.34H8.88a.83.83,0,0,1-.67-1.33l7.54-10.35a.83.83,0,0,1,.24-.22L8.61,7.53A.84.84,0,0,1,9.28,6.2H11a.85.85,0,0,1,.67.34L18,15.38l6.25-8.83A.84.84,0,0,1,25,6.2h1.51a.83.83,0,0,1,.68,1.32l-7.1,9.92,7.5,10.81A.83.83,0,0,1,26.88,29.56Z"
      />
    </svg>
  );
}

// ─── 7. Soft Error Message ───────────────────────────────────────
// Triangle warning, soft pink #f49fa7 — gentle / non-critical errors
export function BotaSoftErrorIcon(props: IconProps) {
  const { width, height, ...rest } = resolveSize(props, 20, 18);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 39.93 35.49"
      width={width}
      height={height}
      aria-label="Soft error"
      {...rest}
    >
      <path
        fill="#f49fa7"
        d="M39.63,32.16,21.88,1.1a2.22,2.22,0,0,0-3.83,0L.3,32.16a2.21,2.21,0,0,0,1.92,3.33H37.71a2.21,2.21,0,0,0,1.92-3.33ZM22.07,11.09,21.61,24.4h-3.3l-.47-13.31ZM22,29.82a1.9,1.9,0,0,1-1.14,1.08,2.47,2.47,0,0,1-.92.16A2.43,2.43,0,0,1,19,30.9a2.12,2.12,0,0,1-.69-.43,1.92,1.92,0,0,1-.44-.65,2,2,0,0,1-.17-.82,2.05,2.05,0,0,1,.17-.83A1.9,1.9,0,0,1,19,27.08a2.43,2.43,0,0,1,.92-.16,2.47,2.47,0,0,1,.92.16,1.92,1.92,0,0,1,.7.43,2,2,0,0,1,.44.66,2.05,2.05,0,0,1,.17.83A2,2,0,0,1,22,29.82Z"
      />
    </svg>
  );
}
