import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';
import 'package:in_app_purchase_storekit/store_kit_wrappers.dart';

import '../models/market_models.dart';
import 'market_repository.dart';
import 'user_facing_error.dart';

typedef IapProgressCallback = void Function(String message);

typedef IapSettledCallback = void Function({
  required bool success,
  required String message,
  bool duplicate,
});

class IapService {
  IapService({required MarketRepository market}) : _market = market;

  final MarketRepository _market;
  final InAppPurchase _iap = InAppPurchase.instance;

  StreamSubscription<List<PurchaseDetails>>? _purchaseSub;
  MarketPolicySnapshot? _policy;
  Map<String, ProductDetails> _storeProducts = {};
  final Set<String> _processingPurchaseIds = {};

  bool storeAvailable = false;
  String? lastError;

  Map<String, ProductDetails> get storeProducts => Map.unmodifiable(_storeProducts);

  Future<void> init({
    required MarketPolicySnapshot policy,
    required Future<PurchaseVerifyResult> Function(PurchaseDetails details, IapPackConfig pack)
        onVerify,
    IapProgressCallback? onProgress,
    IapSettledCallback? onSettled,
  }) async {
    _policy = policy;
    storeAvailable = await _iap.isAvailable();
    if (!storeAvailable) {
      lastError = 'Mağaza bu cihazda kullanılamıyor.';
      return;
    }

    await _purchaseSub?.cancel();
    _purchaseSub = _iap.purchaseStream.listen(
      (purchases) => _onPurchaseUpdates(purchases, onVerify, onProgress, onSettled),
      onError: (Object e) {
        lastError = userFacingError(e, fallback: 'Mağaza bağlantısında sorun oluştu.');
      },
    );

    final ids = policy.productIds.toList();
    if (ids.isEmpty) {
      lastError = 'Market politikasında ürün tanımı yok.';
      return;
    }

    final response = await _iap.queryProductDetails(ids.toSet());
    if (response.error != null) {
      lastError = userFacingError(response.error!.message, fallback: 'Mağaza ürünleri yüklenemedi.');
    }
    _storeProducts = {for (final p in response.productDetails) p.id: p};

    if (response.notFoundIDs.isNotEmpty && kDebugMode) {
      debugPrint('IAP notFoundIDs: ${response.notFoundIDs}');
    }

    await _replayPendingPurchases(onVerify, onProgress, onSettled);
  }

  Future<void> _replayPendingPurchases(
    Future<PurchaseVerifyResult> Function(PurchaseDetails details, IapPackConfig pack) onVerify,
    IapProgressCallback? onProgress,
    IapSettledCallback? onSettled,
  ) async {
    if (Platform.isAndroid) {
      final addition = _iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
      final past = await addition.queryPastPurchases();
      if (past.error == null && past.pastPurchases.isNotEmpty) {
        await _onPurchaseUpdates(past.pastPurchases, onVerify, onProgress, onSettled);
      }
    }
  }

  Future<bool> buy(ProductDetails product) async {
    lastError = null;
    final param = PurchaseParam(productDetails: product);
    final ok = await _iap.buyConsumable(purchaseParam: param, autoConsume: false);
    if (!ok) {
      lastError = 'Satın alma başlatılamadı.';
    }
    return ok;
  }

  Future<void> _onPurchaseUpdates(
    List<PurchaseDetails> purchases,
    Future<PurchaseVerifyResult> Function(PurchaseDetails details, IapPackConfig pack) onVerify,
    IapProgressCallback? onProgress,
    IapSettledCallback? onSettled,
  ) async {
    final policy = _policy;
    if (policy == null) return;

    for (final purchase in purchases) {
      final pack = policy.packFor(purchase.productID);
      if (pack == null) {
        if (purchase.pendingCompletePurchase) {
          await _iap.completePurchase(purchase);
        }
        continue;
      }

      switch (purchase.status) {
        case PurchaseStatus.pending:
          onProgress?.call('Ödeme bekleniyor…');
          break;
        case PurchaseStatus.error:
          lastError = userFacingError(
            purchase.error?.message,
            fallback: 'Satın alma tamamlanamadı.',
          );
          onSettled?.call(success: false, message: lastError!);
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
          break;
        case PurchaseStatus.canceled:
          onSettled?.call(success: false, message: 'Satın alma iptal edildi.');
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          final key = '${purchase.productID}:${purchase.purchaseID ?? purchase.transactionDate}';
          if (_processingPurchaseIds.contains(key)) break;
          _processingPurchaseIds.add(key);
          try {
            onProgress?.call('Sunucu doğrulaması…');
            final result = await onVerify(purchase, pack);
            if (result.ok || result.duplicate) {
              await _finalizePurchase(purchase);
              onSettled?.call(
                success: true,
                message: 'Satın alma tamamlandı.',
                duplicate: result.duplicate,
              );
            } else {
              final msg = userFacingVerificationNote(
                result.verificationNote,
                status: result.status,
              );
              lastError = msg;
              onSettled?.call(success: false, message: msg);
            }
          } catch (e) {
            lastError = userFacingError(e, fallback: 'Sunucu doğrulaması başarısız.');
            onSettled?.call(success: false, message: lastError!);
          } finally {
            _processingPurchaseIds.remove(key);
          }
          break;
      }
    }
  }

  Future<void> _finalizePurchase(PurchaseDetails purchase) async {
    if (Platform.isAndroid) {
      final addition = _iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
      if (purchase is GooglePlayPurchaseDetails) {
        await addition.consumePurchase(purchase);
      }
    }
    if (purchase.pendingCompletePurchase) {
      await _iap.completePurchase(purchase);
    }
  }

  Future<PurchaseVerifyResult> verifyWithBackend(PurchaseDetails purchase, IapPackConfig pack) async {
    if (Platform.isAndroid) {
      final token = purchase.verificationData.serverVerificationData;
      if (token.isEmpty) {
        throw StateError('Google Play ödeme jetonu alınamadı.');
      }
      return _market.verifyAndroid(
        productId: purchase.productID,
        purchaseToken: token,
        currencyKind: pack.currencyKind,
      );
    }

    if (Platform.isIOS) {
      var receipt = purchase.verificationData.serverVerificationData;
      if (receipt.isEmpty || receipt.length < 100) {
        receipt = await _loadIosAppReceipt();
      }
      if (receipt.isEmpty) {
        throw StateError('App Store makbuzu alınamadı. Tekrar deneyin.');
      }
      return _market.verifyIos(
        receiptBase64: receipt,
        expectedProductId: purchase.productID,
        currencyKind: pack.currencyKind,
      );
    }

    throw UnsupportedError('IAP yalnızca iOS/Android.');
  }

  Future<String> _loadIosAppReceipt() async {
    try {
      return await SKReceiptManager.retrieveReceiptData();
    } catch (_) {
      final addition = _iap.getPlatformAddition<InAppPurchaseStoreKitPlatformAddition>();
      await addition.refreshPurchaseVerificationData();
      return await SKReceiptManager.retrieveReceiptData();
    }
  }

  void dispose() {
    _purchaseSub?.cancel();
    _purchaseSub = null;
  }
}
