import React, { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'

const MARKET_ABI = [
  { type: 'function', name: 'buyOutcome', inputs: [{ type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sellOutcome', inputs: [{ type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'splitBase', inputs: [{ type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getPrice', inputs: [{ type: 'uint8' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getReserves', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'question', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'resolved', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'winner', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'resolutionTime', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalLpShares', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'feeBps', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'baseToken', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

const ERC20_ABI = [
  { type: 'function', name: 'allowance', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
] as const

export default function Markets() {
  const { address, isConnected } = useAccount()
  const [marketAddress, setMarketAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [outcome, setOutcome] = useState<'1' | '2'>('1')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [approving, setApproving] = useState(false)

  const addr = marketAddress as `0x${string}` | undefined

  const { data: question } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'question', query: { enabled: !!addr } })
  const { data: resolved } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'resolved', query: { enabled: !!addr } })
  const { data: winner } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'winner', query: { enabled: !!addr } })
  const { data: reserves } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'getReserves', query: { enabled: !!addr } })
  const { data: priceYes } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'getPrice', args: [1], query: { enabled: !!addr } })
  const { data: priceNo } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'getPrice', args: [2], query: { enabled: !!addr } })
  const { data: resolutionTime } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'resolutionTime', query: { enabled: !!addr } })
  const { data: totalLp } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'totalLpShares', query: { enabled: !!addr } })
  const { data: feeBps } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'feeBps', query: { enabled: !!addr } })
  const { data: baseTokenAddr } = useReadContract({ address: addr, abi: MARKET_ABI, functionName: 'baseToken', query: { enabled: !!addr } })
  const baseTokenAddr0x = baseTokenAddr as `0x${string}` | undefined
  const { data: allowance } = useReadContract({ address: baseTokenAddr0x, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, marketAddress as `0x${string}`], query: { enabled: !!baseTokenAddr0x && !!address && !!addr } })
  const { data: baseDecimals } = useReadContract({ address: baseTokenAddr0x, abi: ERC20_ABI, functionName: 'decimals', query: { enabled: !!baseTokenAddr0x } })
  const { data: baseBalance } = useReadContract({ address: baseTokenAddr0x, abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!baseTokenAddr0x && !!address } })

  const decimals = baseDecimals ?? 6

  const { writeContract, isPending } = useWriteContract({
    mutation: {
      onSuccess: (hash) => setTxHash(hash),
      onError: (err: Error) => {
        const msg = err.message.includes('rejected') ? 'Transaction rejected by user'
          : err.message.includes('insufficient') ? 'Insufficient balance'
          : err.message.includes('network') ? 'Wrong network - please switch'
          : `Transaction failed: ${err.message.slice(0, 100)}`
        setError(msg)
      },
    },
  })

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  const needApprove = allowance !== undefined && amount !== '' && (allowance as bigint) < parseUnits(amount, Number(decimals))

  const handleApprove = async () => {
    setError(''); setTxHash(null); setApproving(true)
    if (!marketAddress || !amount) { setError('Fill all fields'); setApproving(false); return }
    try {
      writeContract({
        address: baseTokenAddr0x!,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [marketAddress as `0x${string}`, parseUnits(amount, Number(decimals))],
      })
    } catch (e: any) { setError(e.message) }
    setApproving(false)
  }

  const handleBuy = async () => {
    setError(''); setTxHash(null)
    if (!marketAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: marketAddress as `0x${string}`,
        abi: MARKET_ABI,
        functionName: 'buyOutcome',
        args: [parseInt(outcome), parseUnits(amount, Number(decimals)), BigInt(0)],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handleSplit = async () => {
    setError(''); setTxHash(null)
    if (!marketAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: marketAddress as `0x${string}`,
        abi: MARKET_ABI,
        functionName: 'splitBase',
        args: [parseUnits(amount, Number(decimals))],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handleSell = async () => {
    setError(''); setTxHash(null)
    if (!marketAddress || !amount) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: marketAddress as `0x${string}`,
        abi: MARKET_ABI,
        functionName: 'sellOutcome',
        args: [parseInt(outcome), parseUnits(amount, Number(decimals)), BigInt(0)],
      })
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div>
      <h2 style={{ margin: '16px 0', color: '#aaaaff' }}>Markets</h2>

      {error && <div className="error">{error}</div>}
      {txHash && <div className="success">Tx submitted: {txHash.slice(0, 10)}...</div>}
      {(isPending || isConfirming) && <div className="success">Transaction pending...</div>}

      {!isConnected ? (
        <div className="card"><p>Connect your wallet to trade.</p></div>
      ) : (
        <>
          <div className="card">
            <label>Market Address</label>
            <input value={marketAddress} onChange={e => setMarketAddress(e.target.value)} placeholder="0x..." />
          </div>

          <div className="grid">
            <div className="card">
              <h3>Market Info</h3>
              {question !== undefined && <p><strong>Question:</strong> {String(question)}</p>}
              {resolved !== undefined && <p><strong>Resolved:</strong> {Boolean(resolved) ? 'Yes' : 'No'}</p>}
              {Boolean(resolved) && winner !== undefined && <p><strong>Winner:</strong> {Number(winner) === 1 ? 'YES' : 'NO'}</p>}
              {reserves !== undefined && (
                <>
                  <p><strong>Reserve YES:</strong> {formatUnits((reserves as readonly bigint[])[0], Number(decimals))}</p>
                  <p><strong>Reserve NO:</strong> {formatUnits((reserves as readonly bigint[])[1], Number(decimals))}</p>
                </>
              )}
              {priceYes !== undefined && <p><strong>Price YES:</strong> {(Number(priceYes) / 1e16).toFixed(2)}%</p>}
              {priceNo !== undefined && <p><strong>Price NO:</strong> {(Number(priceNo) / 1e16).toFixed(2)}%</p>}
              {resolutionTime !== undefined && <p><strong>Ends:</strong> {new Date(Number(resolutionTime) * 1000).toLocaleString()}</p>}
              {totalLp !== undefined && <p><strong>LP Shares:</strong> {formatUnits(totalLp as bigint, 18)}</p>}
              {feeBps !== undefined && <p><strong>Fee:</strong> {Number(feeBps) / 100}%</p>}
              {baseBalance !== undefined && <p><strong>Your Balance:</strong> {formatUnits(baseBalance as bigint, Number(decimals))}</p>}
            </div>

            <div className="card">
              <h3>Trade</h3>
              <label>Amount</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="100" />
              <label>Outcome</label>
              <select value={outcome} onChange={e => setOutcome(e.target.value as '1' | '2')}>
                <option value="1">YES</option>
                <option value="2">NO</option>
              </select>
              <div className="flex" style={{ marginTop: 12 }}>
                {!!needApprove && (
                  <button onClick={handleApprove} disabled={isPending || approving}>
                    Approve USDC
                  </button>
                )}
                <button onClick={handleBuy} disabled={isPending || !marketAddress || !amount || !!needApprove}>Buy</button>
                <button onClick={handleSplit} disabled={isPending || !marketAddress || !amount || !!needApprove}>Split</button>
                <button onClick={handleSell} disabled={isPending || !marketAddress || !amount || false}>Sell</button>
              </div>
              {!!needApprove && <p style={{ color: '#ffaa66', fontSize: 12, marginTop: 8 }}>Approve USDC first before buying/splitting</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
