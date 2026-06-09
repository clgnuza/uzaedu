class IapPackConfig {
  const IapPackConfig({
    required this.productId,
    required this.amount,
    required this.currencyKind,
    this.label,
    this.grantYillikPlan = 0,
    this.grantEvrak = 0,
  });

  final String productId;
  final double amount;
  final String currencyKind;
  final String? label;
  final int grantYillikPlan;
  final int grantEvrak;

  static IapPackConfig? fromJson(Map<String, dynamic> json, String currencyKind) {
    final productId = (json['product_id'] ?? json['productId'] ?? '').toString().trim();
    if (productId.isEmpty) return null;
    final amount = _num(json['amount']);
    return IapPackConfig(
      productId: productId,
      amount: amount,
      currencyKind: currencyKind,
      label: json['label']?.toString(),
      grantYillikPlan: _int(json['grant_yillik_plan_uretim'] ?? json['grantYillikPlanUretim']),
      grantEvrak: _int(json['grant_evrak_uretim'] ?? json['grantEvrakUretim']),
    );
  }

  static double _num(dynamic v) {
    final n = double.tryParse(v?.toString() ?? '');
    return n != null && n.isFinite ? n : 0;
  }

  static int _int(dynamic v) {
    final n = int.tryParse(v?.toString() ?? '');
    return n != null && n >= 0 ? n : 0;
  }
}

class MarketPolicySnapshot {
  const MarketPolicySnapshot({
    required this.jetonPacks,
    required this.ekdersPacks,
    this.purchaseDisclosureTr,
    this.purchaseDisclosureEn,
  });

  final List<IapPackConfig> jetonPacks;
  final List<IapPackConfig> ekdersPacks;
  final String? purchaseDisclosureTr;
  final String? purchaseDisclosureEn;

  List<IapPackConfig> get allPacks => [...jetonPacks, ...ekdersPacks];

  Set<String> get productIds => allPacks.map((p) => p.productId).toSet();

  IapPackConfig? packFor(String productId) {
    for (final p in allPacks) {
      if (p.productId == productId) return p;
    }
    return null;
  }

  static MarketPolicySnapshot fromJson(Map<String, dynamic> json, {required bool isIos}) {
    final sideKey = isIos ? 'iap_ios' : 'iap_android';
    final side = json[sideKey];
    final jetonRaw = side is Map ? side['jeton'] : null;
    final ekdersRaw = side is Map ? side['ekders'] : null;
    final jeton = _packList(jetonRaw, 'jeton');
    final ekders = _packList(ekdersRaw, 'ekders');
    final compliance = json['store_compliance'];
    String? discTr;
    String? discEn;
    if (compliance is Map) {
      discTr = compliance['purchase_disclosure_tr']?.toString();
      discEn = compliance['purchase_disclosure_en']?.toString();
    }
    return MarketPolicySnapshot(
      jetonPacks: jeton,
      ekdersPacks: ekders,
      purchaseDisclosureTr: discTr?.trim().isNotEmpty == true ? discTr : null,
      purchaseDisclosureEn: discEn?.trim().isNotEmpty == true ? discEn : null,
    );
  }

  static List<IapPackConfig> _packList(dynamic raw, String currencyKind) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => IapPackConfig.fromJson(Map<String, dynamic>.from(e), currencyKind))
        .whereType<IapPackConfig>()
        .toList();
  }
}

class WalletBalances {
  const WalletBalances({required this.userJeton, required this.userEkders, this.schoolJeton, this.schoolEkders});

  final double userJeton;
  final double userEkders;
  final double? schoolJeton;
  final double? schoolEkders;

  static WalletBalances fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final school = json['school'];
    double uj = 0, ue = 0;
    if (user is Map) {
      uj = _num(user['jeton']);
      ue = _num(user['ekders']);
    }
    double? sj, se;
    if (school is Map) {
      sj = _num(school['jeton']);
      se = _num(school['ekders']);
    }
    return WalletBalances(userJeton: uj, userEkders: ue, schoolJeton: sj, schoolEkders: se);
  }

  static double _num(dynamic v) {
    final n = double.tryParse(v?.toString() ?? '');
    return n != null && n.isFinite ? n : 0;
  }
}

class PurchaseLedgerItem {
  const PurchaseLedgerItem({
    required this.id,
    required this.platform,
    required this.productId,
    required this.status,
    required this.currencyKind,
    required this.creditsApplied,
    this.amountCredited,
    this.createdAt,
    this.verificationNote,
  });

  final String id;
  final String platform;
  final String productId;
  final String status;
  final String currencyKind;
  final bool creditsApplied;
  final String? amountCredited;
  final DateTime? createdAt;
  final String? verificationNote;

  static PurchaseLedgerItem fromJson(Map<String, dynamic> json) {
    DateTime? created;
    final raw = json['createdAt'] ?? json['created_at'];
    if (raw != null) {
      created = DateTime.tryParse(raw.toString());
    }
    return PurchaseLedgerItem(
      id: (json['id'] ?? '').toString(),
      platform: (json['platform'] ?? '').toString(),
      productId: (json['productId'] ?? json['product_id'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      currencyKind: (json['currencyKind'] ?? json['currency_kind'] ?? '').toString(),
      creditsApplied: json['creditsApplied'] == true || json['credits_applied'] == true,
      amountCredited: (json['amountCredited'] ?? json['amount_credited'])?.toString(),
      createdAt: created,
      verificationNote: (json['verificationNote'] ?? json['verification_note'])?.toString(),
    );
  }
}

class PurchaseVerifyResult {
  const PurchaseVerifyResult({
    required this.status,
    required this.creditsApplied,
    required this.duplicate,
    this.verificationNote,
    this.amountCredited,
  });

  final String status;
  final bool creditsApplied;
  final bool duplicate;
  final String? verificationNote;
  final String? amountCredited;

  bool get ok => creditsApplied || (status == 'verified' && !duplicate);

  static PurchaseVerifyResult fromJson(Map<String, dynamic> json) {
    return PurchaseVerifyResult(
      status: (json['status'] ?? '').toString(),
      creditsApplied: json['credits_applied'] == true || json['creditsApplied'] == true,
      duplicate: json['duplicate'] == true,
      verificationNote: (json['verification_note'] ?? json['verificationNote'])?.toString(),
      amountCredited: (json['amount_credited'] ?? json['amountCredited'])?.toString(),
    );
  }
}
