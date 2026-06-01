"""Seed demo data if DB is empty."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import random
from datetime import datetime, timedelta
from models.database import SessionLocal, Base, engine


def seed_if_empty():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from models.trade import Trade
        count = db.query(Trade).count()
        if count > 0:
            return
        _seed(db)
    finally:
        db.close()


def _seed(db):
    from models.account import Account
    from models.trade import Trade
    from models.journal import Journal
    from models.session_plan import SessionPlan
    from models.strategy import Strategy

    # Accounts
    acc1 = Account(name="US Equities", currency="USD", description="Primary stocks trading account")
    acc2 = Account(name="Forex", currency="USD", description="FX pairs account")
    db.add_all([acc1, acc2])
    db.flush()

    # Strategies
    strats = [
        Strategy(name="Breakout", description="Price breakout from key levels", rules='["Wait for confirmed breakout","Volume above average","Risk 1R max"]', asset_class="equity"),
        Strategy(name="Momentum", description="Follow strong trending moves", rules='["Trend aligned","RSI > 50","Risk 1-2%"]', asset_class="equity"),
        Strategy(name="Mean Reversion", description="Fading extended moves", rules='["Price 2SD from mean","Volume spike","Defined risk level"]', asset_class="forex"),
        Strategy(name="News Play", description="Trade around economic events", rules='["Event scheduled","Pre-news entry","Tight stop"]', asset_class="forex"),
    ]
    db.add_all(strats)
    db.flush()

    # Session plans
    plans = [
        SessionPlan(title="Monday Morning Review", date="2025-01-06", planned_risk=500.0, notes="Focus on AAPL and SPY breakouts. Max 3 trades.", actual_pnl=320.0, plan_adherence_notes="Stuck to plan, exited early on 2nd trade"),
        SessionPlan(title="Pre-NFP Plan", date="2025-02-07", planned_risk=200.0, notes="NFP at 8:30. No entries before release. EUR/USD only.", actual_pnl=-150.0, plan_adherence_notes="Entered early — violated plan"),
        SessionPlan(title="Earnings Season Setup", date="2025-04-15", planned_risk=600.0, notes="NVDA and TSLA earnings. Breakout setups only.", actual_pnl=890.0, plan_adherence_notes="Great discipline today"),
    ]
    db.add_all(plans)
    db.flush()

    # Trade data generators
    symbols_eq = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "AMZN", "META", "GOOGL"]
    symbols_fx = ["EURUSD", "GBPJPY", "USDJPY", "AUDUSD"]
    setups = ["Breakout", "Momentum", "Mean Reversion", "News Play"]
    sessions = ["pre-market", "morning", "afternoon", "overnight"]
    tilt_states = ["calm", "calm", "calm", "calm", "fomo", "revenge", "anxious"]
    tags_pool = ["strong-trend", "news-driven", "reversal", "scalp", "swing", "gap-play", "breakout"]

    random.seed(42)
    now = datetime.utcnow()

    trades = []
    journals_data = []

    # Generate 120 trades over last 18 months
    for i in range(120):
        days_ago = random.randint(1, 540)
        hour = random.choice([9, 10, 11, 13, 14, 15])
        minute = random.randint(0, 59)
        entry_dt = now - timedelta(days=days_ago, hours=random.randint(0, 5))
        entry_dt = entry_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)

        is_forex = i >= 80
        account_id = acc2.id if is_forex else acc1.id
        symbol = random.choice(symbols_fx if is_forex else symbols_eq)
        asset_class = "forex" if is_forex else "equity"
        direction = random.choice(["long", "long", "short"])
        setup = random.choice(setups)

        entry_price = round(random.uniform(10, 500), 2) if not is_forex else round(random.uniform(0.8, 180), 4)
        quantity = random.choice([10, 25, 50, 100, 200]) if not is_forex else random.choice([1000, 5000, 10000])

        # Stop loss
        stop_pct = random.uniform(0.005, 0.02)
        stop_loss = round(entry_price * (1 - stop_pct) if direction == "long" else entry_price * (1 + stop_pct), 4)
        risk_per_unit = abs(entry_price - stop_loss)

        # Exit
        hold_hours = random.uniform(0.25, 72)
        exit_dt = entry_dt + timedelta(hours=hold_hours)

        # P&L distribution: ~55% win rate
        win = random.random() < 0.55
        if win:
            r = random.uniform(0.5, 4.0)
            exit_price = round(entry_price + (r * risk_per_unit if direction == "long" else -r * risk_per_unit), 4)
        else:
            r = random.uniform(-2.0, -0.3)
            exit_price = round(entry_price + (r * risk_per_unit if direction == "long" else -r * risk_per_unit), 4)

        if direction == "long":
            pnl = round((exit_price - entry_price) * quantity - random.uniform(1, 15), 2)
        else:
            pnl = round((entry_price - exit_price) * quantity - random.uniform(1, 15), 2)

        r_multiple = round((exit_price - entry_price) / risk_per_unit if direction == "long" else (entry_price - exit_price) / risk_per_unit, 3) if risk_per_unit > 0 else None

        tilt = random.choice(tilt_states)
        session = random.choice(sessions)
        num_tags = random.randint(0, 2)
        tags = ",".join(random.sample(tags_pool, num_tags)) if num_tags > 0 else None

        trade = Trade(
            account_id=account_id,
            import_source="seed",
            asset_class=asset_class,
            symbol=symbol,
            direction=direction,
            entry_date=entry_dt.isoformat(),
            exit_date=exit_dt.isoformat(),
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=quantity,
            pnl=pnl,
            fees=round(random.uniform(1, 15), 2),
            stop_loss=stop_loss,
            r_multiple=r_multiple,
            setup=setup,
            tags=tags,
            session=session,
            tilt_state=tilt,
            has_journal=False,
        )
        trades.append(trade)

    db.add_all(trades)
    db.flush()

    # Add journals to ~60% of trades
    for t in random.sample(trades, int(len(trades) * 0.6)):
        rule_followed = random.random() < 0.72
        confidence = round(random.uniform(4, 9), 1)
        j = Journal(
            trade_id=t.id,
            why_entry=random.choice([
                "Clean breakout above resistance with volume confirmation",
                "RSI oversold bounce off support level",
                "Strong momentum continuation after consolidation",
                "News catalyst — better than expected earnings",
                "Trend line break with increased volume",
            ]),
            why_exit=random.choice([
                "Hit take profit target",
                "Price action showed weakness at resistance",
                "Stop loss triggered",
                "End of day — couldn't hold overnight",
                "Momentum fading",
            ]),
            mistakes=None if rule_followed else random.choice([
                "Entered too early, didn't wait for confirmation",
                "Position size too large for the setup",
                "Moved stop loss when it shouldn't have",
                "FOMO entry after missing the initial move",
            ]),
            confidence_rating=confidence,
            rule_followed=rule_followed,
            tilt_state=t.tilt_state,
            execution_quality_entry=round(random.uniform(5, 10), 1),
            execution_quality_exit=round(random.uniform(4, 10), 1),
        )
        t.has_journal = True
        db.add(j)

    db.commit()
    print(f"[seed] Seeded {len(trades)} trades with journals")


if __name__ == "__main__":
    seed_if_empty()
    print("Done")
