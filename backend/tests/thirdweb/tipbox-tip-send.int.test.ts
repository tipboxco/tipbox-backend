import { TipboxContractService } from '../../src/infrastructure/thirdweb/tipbox.contract.service';

const isEthAddress = (v: unknown) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

describe('Thirdweb tip send (integration)', () => {
  jest.setTimeout(120000);

  const svc = new TipboxContractService();
  const log = (label: string, payload: unknown) => {
    try {
      console.log(`[thirdweb][tip-test] ${label}`, JSON.stringify(payload, null, 2));
    } catch {
      console.log(`[thirdweb][tip-test] ${label}`, payload);
    }
  };

  const requireEnv = (key: string) => {
    const v = String(process.env[key] || '').trim();
    if (!v) throw new Error(`Eksik ENV: ${key} (.env.test içine ekleyin)`);
    return v;
  };

  const getTx = async (txId: string) => {
    const secretKey = requireEnv('THIRDWEB_SECRET_KEY');
    const url = `https://api.thirdweb.com/v1/transactions/${txId}`;
    const res = await fetch(url, { headers: { 'x-secret-key': secretKey } });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`transactions/${txId} failed: ${res.status} ${res.statusText} - ${bodyText.slice(0, 300)}`);
    }
    return JSON.parse(bodyText) as { result?: any };
  };

  const waitTxTerminal = async (txId: string) => {
    const started = Date.now();
    while (true) {
      const tx = await getTx(txId);
      const status = String(tx.result?.status || '').toUpperCase();
      log('tx.status', { txId, status });
      if (['CONFIRMED', 'FAILED', 'CANCELLED', 'REVERTED'].includes(status)) return tx;
      if (Date.now() - started > 90000) {
        throw new Error(`Transaction terminal status timeout: txId=${txId} lastStatus=${status}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  test('tip: başarılı transfer (CONFIRMED) + pendingTips artmalı', async () => {
    const from = requireEnv('TEST_THIRDWEB_FROM_WALLET');
    const target = requireEnv('TEST_THIRDWEB_WALLET_ADDRESS');
    const amount = requireEnv('TEST_TIP_AMOUNT'); // örn: "1" veya token decimals'a göre "1000000000000000000"

    if (!isEthAddress(from)) throw new Error(`TEST_THIRDWEB_FROM_WALLET geçersiz: ${from}`);
    if (!isEthAddress(target)) throw new Error(`TEST_THIRDWEB_WALLET_ADDRESS geçersiz: ${target}`);

    const pendingBefore = await svc.getPendingTips(target);
    const amt = BigInt(amount);

    // Kullanıcı isteği: balance/allowance kontrolü yapmadan direkt tip dene.
    log('prestate', {
      from,
      target,
      amount: amt.toString(),
      pendingBefore: pendingBefore.toString(),
    });

    const res = await svc.tip(from, amt, target);
    log('write.result', res);
    if (!Array.isArray(res.transactionIds) || res.transactionIds.length === 0) {
      throw new Error('contracts/write transactionIds dönmedi');
    }

    const txId = res.transactionIds[0];
    const tx = await waitTxTerminal(txId);
    log('tx.detail', {
      txId,
      status: tx.result?.status ?? null,
      transactionHash: tx.result?.transactionHash ?? null,
      errorMessage: tx.result?.errorMessage ?? tx.result?.error ?? null,
      from: tx.result?.from ?? null,
      to: tx.result?.to ?? null,
      createdAt: tx.result?.createdAt ?? null,
      confirmedAt: tx.result?.confirmedAt ?? null,
    });

    const status = String(tx.result?.status || '').toUpperCase();
    if (status !== 'CONFIRMED') {
      throw new Error(
        `Tip CONFIRMED olmadı. status=${status} error=${String(tx.result?.errorMessage ?? tx.result?.error ?? '')}`
      );
    }

    const pendingAfter = await svc.getPendingTips(target);
    log('poststate', { pendingAfter: pendingAfter.toString() });
    expect(pendingAfter).toBeGreaterThan(pendingBefore);
  });
});

