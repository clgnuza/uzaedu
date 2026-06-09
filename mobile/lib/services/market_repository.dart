import 'dart:io';

import '../config/app_config.dart';
import '../models/market_models.dart';
import 'api_client.dart';

class MarketRepository {
  MarketRepository(this._client);

  final ApiClient _client;

  Future<MarketPolicySnapshot> fetchMarketPolicy() async {
    final public = ApiClient(null);
    final json = await public.getJson('/content/market-policy');
    return MarketPolicySnapshot.fromJson(json, isIos: Platform.isIOS);
  }

  Future<WalletBalances> fetchWallet() async {
    final json = await _client.getJson('/market/wallet');
    return WalletBalances.fromJson(json);
  }

  Future<List<PurchaseLedgerItem>> fetchPurchaseHistory({int page = 1, int limit = 20}) async {
    final json = await _client.getJson('/market/purchases/mine?page=$page&limit=$limit');
    final items = json['items'];
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map((e) => PurchaseLedgerItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<PurchaseVerifyResult> verifyAndroid({
    required String productId,
    required String purchaseToken,
    required String currencyKind,
  }) async {
    final json = await _client.postJson('/market/purchases/verify-android', {
      'product_id': productId,
      'purchase_token': purchaseToken,
      'package_name': AppConfig.androidPackageName,
      'currency_kind': currencyKind,
      'product_kind': 'consumable',
      'credit_account': 'user',
    });
    return PurchaseVerifyResult.fromJson(json);
  }

  Future<PurchaseVerifyResult> verifyIos({
    required String receiptBase64,
    required String expectedProductId,
    required String currencyKind,
  }) async {
    final json = await _client.postJson('/market/purchases/verify-ios', {
      'receipt_data_base64': receiptBase64,
      'expected_product_id': expectedProductId,
      'currency_kind': currencyKind,
      'product_kind': 'consumable',
      'credit_account': 'user',
    });
    return PurchaseVerifyResult.fromJson(json);
  }
}
