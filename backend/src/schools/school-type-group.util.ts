import { SchoolType, SchoolTypeGroup } from '../types/enums';

/** Kademe grubu → okul türleri (GET /schools type_group) */
export const SCHOOL_TYPE_GROUP_MEMBERS: Record<SchoolTypeGroup, SchoolType[]> = {
  [SchoolTypeGroup.ilkogretim]: [SchoolType.ilkokul, SchoolType.ortaokul],
  [SchoolTypeGroup.lise_kademesi]: [
    SchoolType.lise,
    SchoolType.meslek_lisesi,
    SchoolType.imam_hatip_lise,
    SchoolType.bilsem,
  ],
  [SchoolTypeGroup.kurum_diger]: [
    SchoolType.anaokul,
    SchoolType.imam_hatip_ortaokul,
    SchoolType.ozel_egitim,
    SchoolType.halk_egitim,
  ],
};
