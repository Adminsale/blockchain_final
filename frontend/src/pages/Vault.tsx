import React, { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'

const VAULT_ABI = [
  { type: 'function', name: 'asset', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalAssets', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'deposit', inputs: [{ type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdraw', inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'convertToShares', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'convertToAssets', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'previewRedeem', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'withdrawalFeeBps', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const ERC20_ABI = [
  { type: 'function', name: 'allowance', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
] as const

export default function Vault() {
  const { address, isConnected } = useAccount()
  const [vaultAddress, setVaultAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [isDeposit, setIsDeposit] = useState(true)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const addr = vaultAddress as `0x${string}` | undefined

  const { data: totalAssets } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'totalAssets', query: { enabled: !!addr } })
  const { data: totalSupply } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'totalSupply', query: { enabled: !!addr } })
  const { data: userShares } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!addr && !!address } })
  const { data: assetAddr } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'asset', query: { enabled: !!addr } })
  const { data: feeBps } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'withdrawalFeeBps', query: { enabled: !!addr } })
  const { data: allowance } = useReadContract({ address: assetAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, vaultAddress as `0x${string}`], query: { enabled: !!assetAddr && !!address && !!addr } })
  const { data: assetDec } = useReadContract({ address: assetAddr as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', query: { enabled: !!assetAddr } })
  const { data: previewAssets } = useReadContract({ address: addr, abi: VAULT_ABI, functionName: 'previewRedeem', args: [userShares ?? BigInt(0)], query: { enabled: !!addr && userShares !== undefined && (userShares as bigint) > BigInt(0) } })

  const decimals = assetDec ?? 6
  const needApprove = isDeposit && allowance !== undefined && amount !== '' && (allowance as bigint) < parseUnits(amount, Number(decimals))

  const { writeContract, isPending } = useWriteContract({
    mutation: {
      onSuccess: (hash) => setTxHash(hash),
      onError: (err: Error) => {
        setError(err.message.includes('rejected') ? 'Transaction rejected'
          : err.message.includes('balance') ? 'Insufficient balance'
          : `Error: ${err.message.slice(0, 80)}`)
      },
    },
  })

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  const handleApprove = async () => {
    setError(''); setTxHash(null)
    if (!vaultAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: assetAddr as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [vaultAddress as `0x${string}`, parseUnits(amount, Number(decimals))],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handleDeposit = async () => {
    setError(''); setTxHash(null)
    if (!vaultAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: VAULT_ABI, functionName: 'deposit',
        args: [parseUnits(amount, Number(decimals)), address as `0x${string}`],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handleWithdraw = async () => {
    setError(''); setTxHash(null)
    if (!vaultAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: vaultAddress as `0x${string}`,
        abi: VAULT_ABI, functionName: 'withdraw',
        args: [parseUnits(amount, Number(decimals)), address as `0x${string}`, address as `0x${string}`],
      })
    } catch (e: any) { setError(e.message) }
  }

  const feePercent = feeBps !== undefined ? (Number(feeBps) / 100).toFixed(2) : null

  return (
    <div>
      <h2 style={{ margin: '16px 0', color: '#aaaaff' }}>Fee Vault</h2>

      {error && <div className="error">{error}</div>}
      {txHash && <div className="success">Tx: {txHash.slice(0, 10)}...</div>}
      {(isPending || isConfirming) && <div className="success">Transaction pending...</div>}

      {!isConnected ? (
        <div className="card"><p>Connect wallet to interact with the vault.</p></div>
      ) : (
        <>
          <div className="card">
            <label>Vault Address</label>
            <input value={vaultAddress} onChange={e => setVaultAddress(e.target.value)} placeholder="0x..." />
          </div>

          <div className="grid">
            <div className="card">
              <h3>Vault Info</h3>
              {totalAssets !== undefined && <p>Total Assets: {formatUnits(totalAssets as bigint, Number(decimals))}</p>}
              {totalSupply !== undefined && <p>Total Shares: {formatUnits(totalSupply as bigint, 18)}</p>}
              {userShares !== undefined && <p>Your Shares: {formatUnits(userShares as bigint, 18)}</p>}
              {previewAssets !== undefined && userShares !== undefined && (userShares as bigint) > BigInt(0) && (
                <p>Your Assets (preview): {formatUnits(previewAssets as bigint, Number(decimals))}</p>
              )}
              {feePercent && <p>Withdrawal Fee: {feePercent}%</p>}
            </div>

            <div className="card">
              <h3>{isDeposit ? 'Deposit' : 'Withdraw'}</h3>
              <div className="flex" style={{ marginBottom: 12 }}>
                <button onClick={() => setIsDeposit(true)} style={{ opacity: isDeposit ? 1 : 0.5 }}>Deposit</button>
                <button onClick={() => setIsDeposit(false)} style={{ opacity: isDeposit ? 0.5 : 1 }}>Withdraw</button>
              </div>
              <label>Amount</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="1000" />
              {isDeposit && !!needApprove && (
                <button onClick={handleApprove} disabled={isPending} style={{ marginTop: 8, width: '100%' }}>
                  Approve
                </button>
              )}
              <button
                onClick={isDeposit ? handleDeposit : handleWithdraw}
                disabled={!vaultAddress || !amount || (isDeposit && !!needApprove)}
                style={{ marginTop: 8, width: '100%' }}
              >
                {isDeposit ? 'Deposit' : 'Withdraw'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
