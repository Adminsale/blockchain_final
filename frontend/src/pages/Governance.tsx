import React, { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { parseUnits } from 'viem'

const GOVERNOR_ABI = [
  { type: 'function', name: 'proposalThreshold', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'state', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalVotes', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'castVote', inputs: [{ type: 'uint256' }, { type: 'uint8' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getVotes', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'votingDelay', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'votingPeriod', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'quorum', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'propose', inputs: [{ type: 'address[]' }, { type: 'uint256[]' }, { type: 'bytes[]' }, { type: 'string' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'proposalDeadline', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalProposer', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

const GOV_TOKEN_ABI = [
  { type: 'function', name: 'getVotes', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'delegates', inputs: [{ type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'delegate', inputs: [{ type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'allowance', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
] as const

const PROPOSAL_STATES = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']

export default function Governance() {
  const { address, isConnected } = useAccount()
  const { data: blockNumber } = useBlockNumber()
  const [govTokenAddr, setGovTokenAddr] = useState('')
  const [governorAddr, setGovernorAddr] = useState('')
  const [proposalId, setProposalId] = useState('')
  const [voteSupport, setVoteSupport] = useState<'1' | '2' | '0'>('1')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [subgraphProposals, setSubgraphProposals] = useState<any[]>([])

  const [proposalDesc, setProposalDesc] = useState('')
  const [proposalTarget, setProposalTarget] = useState('')
  const [proposalValue, setProposalValue] = useState('0')
  const [proposalCalldata, setProposalCalldata] = useState('0x')

  const { writeContract, isPending } = useWriteContract({
    mutation: {
      onSuccess: (hash) => setTxHash(hash),
      onError: (err: Error) => {
        setError(err.message.includes('rejected') ? 'Transaction rejected' : err.message.slice(0, 100))
      },
    },
  })

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash ?? undefined })

  const { data: votingPower } = useReadContract({
    address: govTokenAddr as `0x${string}`,
    abi: GOV_TOKEN_ABI,
    functionName: 'getVotes',
    args: [address as `0x${string}`],
    query: { enabled: !!govTokenAddr && !!address },
  })

  const { data: tokenBalance } = useReadContract({
    address: govTokenAddr as `0x${string}`,
    abi: GOV_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!govTokenAddr && !!address },
  })

  const { data: delegateAddr } = useReadContract({
    address: govTokenAddr as `0x${string}`,
    abi: GOV_TOKEN_ABI,
    functionName: 'delegates',
    args: [address as `0x${string}`],
    query: { enabled: !!govTokenAddr && !!address },
  })

  const { data: proposalState } = useReadContract({
    address: governorAddr as `0x${string}`,
    abi: GOVERNOR_ABI,
    functionName: 'state',
    args: [proposalId ? BigInt(proposalId) : BigInt(0)],
    query: { enabled: !!governorAddr && !!proposalId },
  })

  const { data: threshold } = useReadContract({
    address: governorAddr as `0x${string}`,
    abi: GOVERNOR_ABI,
    functionName: 'proposalThreshold',
    query: { enabled: !!governorAddr },
  })

  const handleVote = async () => {
    setError(''); setTxHash(null)
    if (!governorAddr || !proposalId) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: governorAddr as `0x${string}`,
        abi: GOVERNOR_ABI,
        functionName: 'castVote',
        args: [BigInt(proposalId), parseInt(voteSupport)],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handleDelegate = async () => {
    setError(''); setTxHash(null)
    if (!govTokenAddr) { setError('Enter governance token address'); return }
    try {
      writeContract({
        address: govTokenAddr as `0x${string}`,
        abi: GOV_TOKEN_ABI,
        functionName: 'delegate',
        args: [address as `0x${string}`],
      })
    } catch (e: any) { setError(e.message) }
  }

  const handlePropose = async () => {
    setError(''); setTxHash(null)
    if (!governorAddr || !proposalDesc || !proposalTarget) { setError('Fill all fields'); return }
    try {
      writeContract({
        address: governorAddr as `0x${string}`,
        abi: GOVERNOR_ABI,
        functionName: 'propose',
        args: [
          [proposalTarget as `0x${string}`],
          [BigInt(proposalValue)],
          [proposalCalldata as `0x${string}`],
          proposalDesc,
        ],
      })
    } catch (e: any) { setError(e.message) }
  }

  const fetchSubgraphProposals = async () => {
    try {
      const res = await fetch(
        'https://api.studio.thegraph.com/query/0/predmark/version/latest',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ proposals(first: 10) { id description forVotes againstVotes abstainVotes executed } }`
          })
        }
      )
      const data = await res.json()
      setSubgraphProposals(data.data?.proposals || [])
    } catch (e) {
      console.log('Subgraph fetch failed:', e)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '16px 0', color: '#aaaaff' }}>Governance</h2>

      {error && <div className="error">{error}</div>}
      {txHash && <div className="success">Tx: {txHash.slice(0, 10)}...</div>}
      {(isPending || isConfirming) && <div className="success">Transaction pending...</div>}

      {!isConnected ? (
        <div className="card"><p>Connect wallet to participate in governance.</p></div>
      ) : (
        <>
          <div className="grid">
            <div className="card">
              <h3>Token Info</h3>
              <label>Governance Token Address</label>
              <input value={govTokenAddr} onChange={e => setGovTokenAddr(e.target.value)} placeholder="0x..." />
              <button onClick={handleDelegate} disabled={!govTokenAddr || isPending}>Delegate to Self</button>
              {tokenBalance !== undefined && <p style={{ marginTop: 12 }}>Balance: {String(tokenBalance)}</p>}
              {votingPower !== undefined && <p>Voting Power: {String(votingPower)}</p>}
              {delegateAddr !== undefined && <p>Delegate: {delegateAddr === address ? 'Self' : (delegateAddr as string).slice(0, 10)}</p>}
            </div>

            <div className="card">
              <h3>Create Proposal</h3>
              <label>Governor Address</label>
              <input value={governorAddr} onChange={e => setGovernorAddr(e.target.value)} placeholder="0x..." />
              <label>Target Contract</label>
              <input value={proposalTarget} onChange={e => setProposalTarget(e.target.value)} placeholder="0x..." />
              <label>Value (ETH)</label>
              <input value={proposalValue} onChange={e => setProposalValue(e.target.value)} type="number" placeholder="0" />
              <label>Calldata (hex)</label>
              <input value={proposalCalldata} onChange={e => setProposalCalldata(e.target.value)} placeholder="0x" />
              <label>Description</label>
              <input value={proposalDesc} onChange={e => setProposalDesc(e.target.value)} placeholder="Proposal description..." />
              {threshold !== undefined && <p style={{ fontSize: 12, color: '#8888cc', marginTop: 8 }}>Threshold: {String(threshold)}</p>}
              <button onClick={handlePropose} disabled={!governorAddr || !proposalTarget || !proposalDesc || isPending} style={{ marginTop: 12 }}>
                Create Proposal
              </button>
            </div>
          </div>

          <div className="grid">
            <div className="card">
              <h3>Vote on Proposal</h3>
              <label>Governor Address</label>
              <input value={governorAddr} onChange={e => setGovernorAddr(e.target.value)} placeholder="0x..." />
              <label>Proposal ID</label>
              <input value={proposalId} onChange={e => setProposalId(e.target.value)} placeholder="123" />
              <label>Support</label>
              <select value={voteSupport} onChange={e => setVoteSupport(e.target.value as '1' | '2' | '0')}>
                <option value="1">For</option>
                <option value="0">Against</option>
                <option value="2">Abstain</option>
              </select>
              <button onClick={handleVote} disabled={!governorAddr || !proposalId || isPending} style={{ marginTop: 12 }}>
                Cast Vote
              </button>
              {proposalState !== undefined && (
                <p style={{ marginTop: 12 }}>State: <span className={`badge badge-${PROPOSAL_STATES[Number(proposalState)]?.toLowerCase() || ''}`}>{PROPOSAL_STATES[Number(proposalState)] || 'Unknown'}</span></p>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Subgraph Proposals</h3>
            <button onClick={fetchSubgraphProposals}>Fetch Proposals</button>
            {subgraphProposals.length > 0 && (
              <table style={{ marginTop: 16 }}>
                <thead>
                  <tr><th>ID</th><th>Description</th><th>For</th><th>Against</th><th>Executed</th></tr>
                </thead>
                <tbody>
                  {subgraphProposals.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.id.slice(0, 8)}...</td>
                      <td>{p.description?.slice(0, 40)}</td>
                      <td>{p.forVotes}</td>
                      <td>{p.againstVotes}</td>
                      <td>{p.executed ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
