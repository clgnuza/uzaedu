/** Manifest share_target + file_handlers (W3C PWA genişletmeleri) */
export const PWA_SHARE_TARGET = {
  action: '/pwa/gelen',
  method: 'GET' as const,
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
  },
};

export const PWA_FILE_HANDLERS = [
  {
    action: '/pwa/dosya',
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
    },
  },
];

/** Yeni bildirim tıklanınca mevcut PWA penceresine git (destekleyen tarayıcılar) */
export const PWA_LAUNCH_HANDLER = {
  client_mode: 'navigate-existing' as const,
};
