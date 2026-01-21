import { TipboxContractService } from '../../src/infrastructure/thirdweb/tipbox.contract.service';

const isEthAddress = (v: unknown) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

describe('Thirdweb TipboxContractService (integration)', () => {
  jest.setTimeout(60000);

  const svc = new TipboxContractService();
  const log = (label: string, payload: unknown) => {
    try {
      console.log(`[thirdweb][test] ${label}`, JSON.stringify(payload, null, 2));
    } catch {
      console.log(`[thirdweb][test] ${label}`, payload);
    }
  };

  const getServerWallets = async () => {
    const secretKey = String(process.env.THIRDWEB_SECRET_KEY);
    const res = await fetch('https://api.thirdweb.com/v1/wallets/server', {
      headers: { 'x-secret-key': secretKey },
    });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`wallets/server failed: ${res.status} ${res.statusText} - ${bodyText.slice(0, 300)}`);
    }
    return JSON.parse(bodyText) as { result?: { wallets?: Array<{ address?: string }> } };
  };

  beforeAll(() => {
    const required = [
      'THIRDWEB_SECRET_KEY',
      'TIPBOX_CHAIN_ID',
      'TIPBOX_CONTRACT_ADDRESS',
      'TEST_THIRDWEB_WALLET_ADDRESS',
    ] as const;

    const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim().length === 0);
    if (missing.length > 0) {
      throw new Error(
        `Thirdweb integration testleri katı modda çalışır. Eksik ENV: ${missing.join(
          ', '
        )}. (.env.test içine ekleyin)`
      );
    }

    const chainId = Number(process.env.TIPBOX_CHAIN_ID);
    if (!Number.isFinite(chainId) || chainId <= 0) {
      throw new Error(`TIPBOX_CHAIN_ID geçersiz: ${process.env.TIPBOX_CHAIN_ID}`);
    }

    if (!isEthAddress(process.env.TIPBOX_CONTRACT_ADDRESS)) {
      throw new Error(`TIPBOX_CONTRACT_ADDRESS geçersiz: ${process.env.TIPBOX_CONTRACT_ADDRESS}`);
    }
    if (!isEthAddress(process.env.TEST_THIRDWEB_WALLET_ADDRESS)) {
      throw new Error(`TEST_THIRDWEB_WALLET_ADDRESS geçersiz: ${process.env.TEST_THIRDWEB_WALLET_ADDRESS}`);
    }
  });

  const getTx = async (txId: string) => {
    const secretKey = String(process.env.THIRDWEB_SECRET_KEY);
    const url = `https://api.thirdweb.com/v1/transactions/${txId}`;
    const res = await fetch(url, { headers: { 'x-secret-key': secretKey } });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`transactions/${txId} failed: ${res.status} ${res.statusText} - ${bodyText.slice(0, 300)}`);
    }
    return JSON.parse(bodyText) as { result?: any };
  };

  const waitTxVisible = async (txId: string) => {
    let lastErr: unknown = null;
    for (let i = 0; i < 10; i++) {
      try {
        return await getTx(txId);
      } catch (e) {
        lastErr = e;
        // kısa bekleme (indexing gecikmesi olabilir)
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };

  const isTerminalStatus = (status: unknown) => {
    const s = String(status || '').toUpperCase();
    return s === 'CONFIRMED' || s === 'FAILED' || s === 'CANCELLED' || s === 'REVERTED';
  };

  const waitTxTerminal = async (txId: string, opts?: { timeoutMs?: number; intervalMs?: number }) => {
    const timeoutMs = opts?.timeoutMs ?? 60000;
    const intervalMs = opts?.intervalMs ?? 2000;
    const started = Date.now();

    // önce görünür olana kadar bekle
    let tx = await waitTxVisible(txId);

    while (!isTerminalStatus(tx.result?.status)) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Transaction terminal status timeout: txId=${txId} lastStatus=${tx.result?.status}`);
      }

      log('write.tx.wait', { txId, status: tx.result?.status });
      await new Promise((r) => setTimeout(r, intervalMs));
      tx = await getTx(txId);
    }

    return tx;
  };

  const expectTxIds = (txIds: unknown) => {
    expect(Array.isArray(txIds)).toBe(true);
    const arr = txIds as unknown[];
    expect(arr.length).toBeGreaterThan(0);
    expect(arr.every((x) => typeof x === 'string' && x.length > 0)).toBe(true);
  };

  test('read: snapshot + tekil endpointler tutarlı olmalı', async () => {
    const walletAddress = process.env.TEST_THIRDWEB_WALLET_ADDRESS as string;
    const snap = await svc.getContractSnapshot({ walletAddress });

    expect(isEthAddress(snap.badgesContract)).toBe(true);
    expect(isEthAddress(snap.tokenContract)).toBe(true);
    expect(isEthAddress(snap.feeRecipient)).toBe(true);
    expect(isEthAddress(snap.owner)).toBe(true);
    expect(typeof snap.feePercentage).toBe('bigint');
    expect(snap.feePercentage).toBeGreaterThanOrEqual(0n);
    expect(snap.pendingTips).toBeDefined();
    expect(typeof snap.pendingTips).toBe('bigint');

    const [badges, token, feeRecipient, owner, feePct, pending] = await Promise.all([
      svc.getBadgesContract(),
      svc.getTokenContract(),
      svc.getFeeRecipient(),
      svc.getOwner(),
      svc.getFeePercentage(),
      svc.getPendingTips(walletAddress),
    ]);
    console.log('badges', badges);
    console.log('token', token);
    console.log('feeRecipient', feeRecipient);
    console.log('owner', owner);
    console.log('feePct', feePct);
    console.log('pending', pending);
    console.log('snap.badgesContract', snap.badgesContract);
    console.log('snap.tokenContract', snap.tokenContract);
    console.log('snap.feeRecipient', snap.feeRecipient);
    console.log('snap.owner', snap.owner);
    console.log('snap.feePercentage', snap.feePercentage);
    console.log('snap.pendingTips', snap.pendingTips);
    expect(badges).toBe(snap.badgesContract);
    expect(token).toBe(snap.tokenContract);
    expect(feeRecipient).toBe(snap.feeRecipient);
    expect(owner).toBe(snap.owner);
    expect(feePct).toBe(snap.feePercentage);
    expect(pending).toBe(snap.pendingTips);
  });

  // Owner-only write testleri kullanıcı isteği ile kapatıldı.
});

