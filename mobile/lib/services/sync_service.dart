import 'package:connectivity_plus/connectivity_plus.dart';

import 'api_client.dart';
import 'offline_scan_queue.dart';

class SyncService {
  SyncService(this._api);

  final ApiClient _api;
  final _queue = OfflineScanQueue();

  Future<bool> get isOnline async {
    final r = await Connectivity().checkConnectivity();
    return r.contains(ConnectivityResult.mobile) ||
        r.contains(ConnectivityResult.wifi) ||
        r.contains(ConnectivityResult.ethernet);
  }

  Future<int> flushQueue() async {
    if (!await isOnline) return 0;
    final pending = await _queue.list();
    var ok = 0;
    for (final item in pending) {
      try {
        await _api.postJson(item.path, item.body);
        await _queue.remove(item.id);
        ok++;
      } catch (_) {
        /* sonraki denemede */
      }
    }
    return ok;
  }

  Future<int> pendingCount() async => (await _queue.list()).length;
}
