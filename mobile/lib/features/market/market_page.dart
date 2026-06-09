import 'dart:io';

import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../models/market_models.dart';
import '../../services/api_client.dart';
import '../../services/iap_service.dart';
import '../../services/market_repository.dart';
import '../../services/user_facing_error.dart';

class MarketPage extends StatefulWidget {
  const MarketPage({super.key, required this.token});

  final String token;

  @override
  State<MarketPage> createState() => _MarketPageState();
}

enum _MarketBannerKind { info, success, error }

class _MarketPageState extends State<MarketPage> {
  late final MarketRepository _repo = MarketRepository(ApiClient(widget.token));
  late final IapService _iap = IapService(market: _repo);

  bool _loading = true;
  String? _bannerMessage;
  _MarketBannerKind _bannerKind = _MarketBannerKind.info;
  WalletBalances? _wallet;
  MarketPolicySnapshot? _policy;
  List<PurchaseLedgerItem> _history = [];
  String? _buyingProductId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _iap.dispose();
    super.dispose();
  }

  void _setBanner(String? message, {_MarketBannerKind kind = _MarketBannerKind.info}) {
    if (!mounted) return;
    setState(() {
      _bannerMessage = message;
      _bannerKind = kind;
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _bannerMessage = null;
    });
    try {
      final policy = await _repo.fetchMarketPolicy();
      final wallet = await _repo.fetchWallet();
      final history = await _repo.fetchPurchaseHistory();
      await _iap.init(
        policy: policy,
        onVerify: _iap.verifyWithBackend,
        onProgress: (msg) => _setBanner(msg),
        onSettled: ({required success, required message, bool duplicate = false}) {
          if (!mounted) return;
          setState(() => _buyingProductId = null);
          if (success) {
            _setBanner(duplicate ? 'Bu işlem daha önce yüklenmiş.' : message, kind: _MarketBannerKind.success);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(duplicate ? 'Zaten işlenmiş' : 'Bakiye güncellendi')),
            );
            void refresh() => _refreshWallet();
            refresh();
          } else {
            _setBanner(message, kind: _MarketBannerKind.error);
          }
        },
      );
      if (!mounted) return;
      setState(() {
        _policy = policy;
        _wallet = wallet;
        _history = history;
        _loading = false;
      });
      if (_iap.lastError != null && policy.productIds.isNotEmpty) {
        _setBanner(_iap.lastError!, kind: _MarketBannerKind.error);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _setBanner(userFacingError(e, fallback: 'Cüzdan yüklenemedi.'), kind: _MarketBannerKind.error);
    }
  }

  Future<void> _buy(ProductDetails product, IapPackConfig pack) async {
    setState(() {
      _buyingProductId = product.id;
      _bannerMessage = 'Mağaza ödeme ekranı açılıyor…';
      _bannerKind = _MarketBannerKind.info;
    });
    try {
      final started = await _iap.buy(product);
      if (!started && mounted) {
        setState(() => _buyingProductId = null);
        _setBanner(_iap.lastError ?? 'Satın alma başlatılamadı.', kind: _MarketBannerKind.error);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _buyingProductId = null);
      _setBanner(userFacingError(e, fallback: 'Satın alma başlatılamadı.'), kind: _MarketBannerKind.error);
    }
  }

  Future<void> _refreshWallet() async {
    try {
      final wallet = await _repo.fetchWallet();
      final history = await _repo.fetchPurchaseHistory();
      if (!mounted) return;
      setState(() {
        _wallet = wallet;
        _history = history;
      });
    } catch (_) {}
  }

  String _fmtNum(double n) {
    if (n == n.roundToDouble()) return n.toStringAsFixed(0);
    return n.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cüzdan'),
        actions: [
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  if (_wallet != null) _WalletHeroCard(wallet: _wallet!, fmt: _fmtNum),
                  if (_bannerMessage != null) ...[
                    const SizedBox(height: 12),
                    _StatusBanner(message: _bannerMessage!, kind: _bannerKind),
                  ],
                  const SizedBox(height: 20),
                  _SectionTitle(
                    title: 'Mağaza paketleri',
                    subtitle: Platform.isIOS ? 'App Store üzerinden güvenli ödeme' : 'Google Play üzerinden güvenli ödeme',
                  ),
                  const SizedBox(height: 10),
                  ..._productSections(),
                  if (_policy?.purchaseDisclosureTr != null) ...[
                    const SizedBox(height: 20),
                    _DisclosureCard(text: _policy!.purchaseDisclosureTr!),
                  ],
                  const SizedBox(height: 24),
                  _SectionTitle(title: 'Satın alma geçmişi', subtitle: 'Son 10 işlem'),
                  const SizedBox(height: 8),
                  if (_history.isEmpty)
                    const _EmptyHint(text: 'Henüz mağaza satın alması yok.')
                  else
                    Card(
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: _history.take(10).map(_historyTile).toList(),
                      ),
                    ),
                ],
              ),
            ),
      bottomNavigationBar: _buyingProductId != null
          ? Material(
              elevation: 8,
              color: cs.surfaceContainerHighest,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Ödeme işleniyor… Mağaza penceresini kapatmayın.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }

  List<Widget> _productSections() {
    final policy = _policy;
    if (policy == null || policy.allPacks.isEmpty) {
      return const [
        _EmptyHint(
          text: 'Ürün listesi boş. Yönetici panelinden Market Politikası → mağaza product_id ekleyin.',
        ),
      ];
    }
    if (!_iap.storeAvailable) {
      return [_EmptyHint(text: _iap.lastError ?? 'Mağaza bu cihazda kullanılamıyor.')];
    }

    final widgets = <Widget>[];
    void addSection(String title, IconData icon, Color tint, List<IapPackConfig> packs) {
      if (packs.isEmpty) return;
      widgets.addAll([
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 8),
          child: Row(
            children: [
              Icon(icon, size: 18, color: tint),
              const SizedBox(width: 6),
              Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        ...packs.map((pack) {
          final store = _iap.storeProducts[pack.productId];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _PackCard(
              pack: pack,
              store: store,
              busy: _buyingProductId == pack.productId,
              disabled: _buyingProductId != null && _buyingProductId != pack.productId,
              fmt: _fmtNum,
              onBuy: store == null ? null : () => _buy(store, pack),
            ),
          );
        }),
      ]);
    }

    addSection('Jeton', Icons.toll_rounded, Colors.amber.shade800, policy.jetonPacks);
    addSection('Ek ders', Icons.schedule_rounded, Colors.blue.shade700, policy.ekdersPacks);

    if (widgets.isEmpty) {
      return const [
        _EmptyHint(
          text: 'Mağazada eşleşen ürün yok. Play Console / App Store Connect product_id’leri politika ile aynı olmalı.',
        ),
      ];
    }
    return widgets;
  }

  Widget _historyTile(PurchaseLedgerItem item) {
    final credited = item.creditsApplied && item.amountCredited != null;
    return ListTile(
      leading: CircleAvatar(
        radius: 18,
        child: Icon(item.platform == 'ios' ? Icons.apple : Icons.android, size: 18),
      ),
      title: Text(item.productId, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${_statusLabel(item.status)}${credited ? ' · +${item.amountCredited} ${_currencyLabel(item.currencyKind)}' : ''}',
      ),
      trailing: item.createdAt != null
          ? Text(
              '${item.createdAt!.day.toString().padLeft(2, '0')}.${item.createdAt!.month.toString().padLeft(2, '0')}.${item.createdAt!.year}',
              style: Theme.of(context).textTheme.bodySmall,
            )
          : null,
    );
  }

  static String _statusLabel(String status) {
    switch (status) {
      case 'verified':
        return 'Onaylandı';
      case 'duplicate':
        return 'Yinelenen';
      case 'rejected':
        return 'Reddedildi';
      case 'pending':
        return 'Bekliyor';
      case 'skipped_no_credentials':
        return 'Doğrulama yapılandırılmamış';
      default:
        return status;
    }
  }

  static String _currencyLabel(String kind) {
    return kind == 'ekders' ? 'ek ders' : 'jeton';
  }
}

class _WalletHeroCard extends StatelessWidget {
  const _WalletHeroCard({required this.wallet, required this.fmt});

  final WalletBalances wallet;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [cs.primary, cs.tertiary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bakiyeniz', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: cs.onPrimary.withValues(alpha: 0.9))),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _BalanceChip(label: 'Jeton', value: fmt(wallet.userJeton), icon: Icons.toll_rounded)),
              const SizedBox(width: 12),
              Expanded(child: _BalanceChip(label: 'Ek ders', value: fmt(wallet.userEkders), icon: Icons.schedule_rounded)),
            ],
          ),
        ],
      ),
    );
  }
}

class _BalanceChip extends StatelessWidget {
  const _BalanceChip({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: Colors.white.withValues(alpha: 0.9)),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.message, required this.kind});

  final String message;
  final _MarketBannerKind kind;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, IconData icon) = switch (kind) {
      _MarketBannerKind.success => (Colors.green.shade50, Colors.green.shade900, Icons.check_circle_outline),
      _MarketBannerKind.error => (Theme.of(context).colorScheme.errorContainer, Theme.of(context).colorScheme.onErrorContainer, Icons.error_outline),
      _MarketBannerKind.info => (Theme.of(context).colorScheme.surfaceContainerHighest, Theme.of(context).colorScheme.onSurfaceVariant, Icons.info_outline),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: TextStyle(color: fg, fontSize: 13))),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(subtitle!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline)),
          ),
      ],
    );
  }
}

class _PackCard extends StatelessWidget {
  const _PackCard({
    required this.pack,
    required this.store,
    required this.busy,
    required this.disabled,
    required this.fmt,
    this.onBuy,
  });

  final IapPackConfig pack;
  final ProductDetails? store;
  final bool busy;
  final bool disabled;
  final String Function(double) fmt;
  final VoidCallback? onBuy;

  @override
  Widget build(BuildContext context) {
    final grants = <String>[];
    if (pack.grantYillikPlan > 0) grants.add('+${pack.grantYillikPlan} plan');
    if (pack.grantEvrak > 0) grants.add('+${pack.grantEvrak} evrak');

    final title = pack.label?.trim().isNotEmpty == true ? pack.label!.trim() : pack.productId;
    final amountLabel = '${fmt(pack.amount)} ${pack.currencyKind == 'ekders' ? 'ek ders' : 'jeton'}';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(amountLabel, style: Theme.of(context).textTheme.bodyLarge),
            if (grants.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(grants.join(' · '), style: Theme.of(context).textTheme.bodySmall),
              ),
            if (store == null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Mağazada bulunamadı: ${pack.productId}',
                  style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                ),
              ),
            if (store != null) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: (busy || disabled) ? null : onBuy,
                  child: busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Satın al · ${store!.price}'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DisclosureCard extends StatelessWidget {
  const _DisclosureCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ExpansionTile(
        title: const Text('Satın alma bilgilendirmesi'),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [Text(text, style: Theme.of(context).textTheme.bodySmall)],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}
