/** BİLSEM takvim / ayarlar — ortak sekme stilleri (pastel) */
export const BILSEM_VIEW_TAB_STYLES = {
  a: {
    active:
      'border-sky-400/45 bg-sky-500/18 font-semibold text-sky-950 shadow-sm ring-1 ring-sky-400/30 dark:text-sky-100',
    idle: 'border-transparent bg-sky-500/10 text-sky-900/80 hover:bg-sky-500/16 dark:bg-sky-950/35 dark:text-sky-200',
  },
  b: {
    active:
      'border-violet-400/45 bg-violet-500/18 font-semibold text-violet-950 shadow-sm ring-1 ring-violet-400/30 dark:text-violet-100',
    idle: 'border-transparent bg-violet-500/10 text-violet-900/80 hover:bg-violet-500/16 dark:bg-violet-950/40 dark:text-violet-200',
  },
} as const;

export const BILSEM_AYAR_TAB_STYLES = {
  sablon: BILSEM_VIEW_TAB_STYLES.a,
  ozel: {
    active:
      'border-fuchsia-400/45 bg-fuchsia-500/18 font-semibold text-fuchsia-950 shadow-sm ring-1 ring-fuchsia-400/30 dark:text-fuchsia-100',
    idle: 'border-transparent bg-fuchsia-500/10 text-fuchsia-900/80 hover:bg-fuchsia-500/16 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
  },
} as const;
