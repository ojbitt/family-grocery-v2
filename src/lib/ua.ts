// Best-effort, dependency-free User-Agent → "Browser · Device" label for the
// sign-in log. Heuristic and deliberately small; unknown UAs fall back to a
// trimmed raw string.

export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  const s = ua;

  const browser =
    /\bEdg(?:iOS|A|)?\//.test(s) ? 'Edge'
    : /\bOPR\/|\bOpera/.test(s) ? 'Opera'
    : /\bFirefox\/|\bFxiOS\//.test(s) ? 'Firefox'
    : /\bChrome\/|\bCriOS\//.test(s) ? 'Chrome'
    : /\bSafari\//.test(s) ? 'Safari'
    : '';

  const os =
    /\biPhone\b/.test(s) ? 'iPhone'
    : /\biPad\b/.test(s) ? 'iPad'
    : /\bAndroid\b/.test(s) ? 'Android'
    : /\bMac OS X\b|\bMacintosh\b/.test(s) ? 'Mac'
    : /\bWindows\b/.test(s) ? 'Windows'
    : /\bLinux\b/.test(s) ? 'Linux'
    : /\bCFNetwork\b/.test(s) ? 'iOS app'
    : '';

  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}
