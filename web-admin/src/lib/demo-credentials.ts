/**
 * Yerel demo hesap şifreleri – backend `src/seed/demo-credentials.ts` ile aynı tutulmalı.
 */
export const DEMO_CREDENTIALS = {
  teacher: {
    email: 'teacher@demo.local',
    password: 'Tr9m!kL2$vNx8Qw@bR4hJ',
    label: 'Test Öğretmen',
  },
  school_admin: {
    email: 'school_admin@demo.local',
    password: 'Sa3z&yU7!wE5sA2#cF6g',
    label: 'Okul Admin',
  },
  superadmin: {
    email: 'superadmin@demo.local',
    password: 'Su1n^qV4%pX9dK8*hL0j',
    label: 'Superadmin',
  },
} as const;
