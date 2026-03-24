/**
 * App Store verifyReceipt (legacy) — tüketilebilir / abonelik için sunucu doğrulaması.
 * Üretimde App Store Server API / StoreKit 2 JWS doğrulamasına geçmeyi değerlendirin.
 */

const PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

export type AppleVerifyReceiptResult = {
  ok: boolean;
  status: number;
  environment?: string;
  productIds?: string[];
  rawStatus?: number;
  error?: string;
};

export async function verifyIosReceipt(params: {
  receiptDataBase64: string;
  sharedSecret: string;
}): Promise<AppleVerifyReceiptResult> {
  const { receiptDataBase64, sharedSecret } = params;
  const body = JSON.stringify({
    'receipt-data': receiptDataBase64,
    password: sharedSecret,
    'exclude-old-transactions': true,
  });
  let res = await fetch(PROD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  let data = (await res.json()) as { status?: number; environment?: string; latest_receipt_info?: { product_id?: string }[] };
  const status = data?.status ?? -1;
  if (status === 21007) {
    res = await fetch(SANDBOX, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    data = (await res.json()) as typeof data;
  }
  const finalStatus = data?.status ?? -1;
  const productIds = Array.isArray(data?.latest_receipt_info)
    ? data.latest_receipt_info.map((x) => x?.product_id).filter(Boolean) as string[]
    : [];
  if (finalStatus !== 0) {
    return {
      ok: false,
      status: finalStatus,
      environment: data?.environment,
      productIds,
      error: `Apple status ${finalStatus}`,
    };
  }
  return {
    ok: true,
    status: finalStatus,
    environment: data?.environment,
    productIds,
  };
}

export function getAppleSharedSecret(): string | null {
  const v = process.env.APPLE_SHARED_SECRET?.trim();
  return v?.length ? v : null;
}
