import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  TokensPurchased as TokensPurchasedEvent,
  TokensSold as TokensSoldEvent,
  LiquidityAdded as LiquidityAddedEvent,
  LiquidityRemoved as LiquidityRemovedEvent,
  MarketResolved as MarketResolvedEvent,
  PredictionMarket
} from "../generated/PredictionMarket/PredictionMarket"
import { Market, Trade, LiquidityChange } from "../generated/schema"

function ensureMarket(id: string, timestamp: BigInt): Market {
  let market = Market.load(id)
  if (market != null) return market

  market = new Market(id)
  market.marketId = BigInt.zero()
  market.question = ""
  market.creator = Bytes.empty()
  market.resolutionTime = BigInt.zero()
  market.resolved = false
  market.winner = 0
  market.outcomeToken = Bytes.empty()
  market.baseToken = Bytes.empty()
  market.reserveYes = BigInt.zero()
  market.reserveNo = BigInt.zero()
  market.feeBps = 0
  market.totalLpShares = BigInt.zero()
  market.createdAt = timestamp
  market.save()
  return market
}

export function handleTokensPurchased(event: TokensPurchasedEvent): void {
  ensureMarket(event.address.toHexString(), event.block.timestamp)

  let trade = new Trade(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  trade.market = event.address.toHexString()
  trade.trader = event.params.buyer
  trade.outcome = event.params.outcome
  trade.amountIn = event.params.amountIn
  trade.amountOut = event.params.amountOut
  trade.timestamp = event.block.timestamp
  trade.save()
}

export function handleTokensSold(event: TokensSoldEvent): void {
  ensureMarket(event.address.toHexString(), event.block.timestamp)

  let trade = new Trade(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  trade.market = event.address.toHexString()
  trade.trader = event.params.seller
  trade.outcome = event.params.outcome
  trade.amountIn = event.params.amountIn
  trade.amountOut = event.params.amountOut
  trade.timestamp = event.block.timestamp
  trade.save()
}

export function handleLiquidityAdded(event: LiquidityAddedEvent): void {
  let market = ensureMarket(event.address.toHexString(), event.block.timestamp)

  market.reserveYes = market.reserveYes.plus(event.params.amountYes)
  market.reserveNo = market.reserveNo.plus(event.params.amountNo)
  market.totalLpShares = market.totalLpShares.plus(event.params.shares)
  market.save()

  let lc = new LiquidityChange(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  lc.market = event.address.toHexString()
  lc.provider = event.params.lp
  lc.amountYes = event.params.amountYes
  lc.amountNo = event.params.amountNo
  lc.shares = event.params.shares
  lc.isAdd = true
  lc.timestamp = event.block.timestamp
  lc.save()
}

export function handleLiquidityRemoved(event: LiquidityRemovedEvent): void {
  let market = ensureMarket(event.address.toHexString(), event.block.timestamp)

  market.reserveYes = market.reserveYes.minus(event.params.amountYes)
  market.reserveNo = market.reserveNo.minus(event.params.amountNo)
  market.totalLpShares = market.totalLpShares.minus(event.params.shares)
  market.save()

  let lc = new LiquidityChange(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  lc.market = event.address.toHexString()
  lc.provider = event.params.lp
  lc.amountYes = event.params.amountYes
  lc.amountNo = event.params.amountNo
  lc.shares = event.params.shares
  lc.isAdd = false
  lc.timestamp = event.block.timestamp
  lc.save()
}

export function handleMarketResolved(event: MarketResolvedEvent): void {
  let market = ensureMarket(event.address.toHexString(), event.block.timestamp)

  market.resolved = true
  market.winner = event.params.winner
  market.save()
}
