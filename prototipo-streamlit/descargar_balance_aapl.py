"""Descarga el balance anual de AAPL desde los endpoints públicos de Yahoo.

Ejecutar: .venv/bin/python descargar_balance_aapl.py
Dependencia opcional: pip install yfinance
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf


def main():
    base = Path(__file__).resolve().parent
    output_dir = base / "datos" / "aapl"
    output_dir.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(base / ".cache" / "yfinance"))
    balance = yf.Ticker("AAPL").get_balance_sheet(freq="yearly", pretty=False)
    if balance.empty:
        raise RuntimeError("Yahoo no devolvió partidas del balance. No se ha guardado un archivo vacío.")

    periods = sorted(balance.columns)
    payload = {
        "symbol": "AAPL",
        "source": "Yahoo Finance public endpoints via yfinance",
        "source_url": "https://finance.yahoo.com/quote/AAPL/balance-sheet/",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "frequency": "annual",
        "monetary_unit": "USD (whole dollars, not thousands)",
        "share_count_unit": "shares",
        "yfinance_version": yf.__version__,
        "periods": [p.date().isoformat() for p in periods],
        "balance_sheet": {
            item: {
                p.date().isoformat(): None if pd.isna(balance.at[item, p]) else float(balance.at[item, p])
                for p in periods
            }
            for item in balance.index
        },
    }
    target = output_dir / "balance_aapl_api.json"
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"file": str(target), "items": len(balance), "periods": payload["periods"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
