"""Demo local para analizar ratios financieros a partir de CSV o Excel."""

from __future__ import annotations

import io
import re
import unicodedata
from typing import Any

import pandas as pd
import streamlit as st


st.set_page_config(page_title="Analizador financiero", page_icon="📊", layout="wide")

FIELDS = {
    "activo_corriente": {
        "label": "Activo corriente",
        "aliases": ["activo corriente", "activos corrientes", "current assets"],
    },
    "pasivo_corriente": {
        "label": "Pasivo corriente",
        "aliases": ["pasivo corriente", "pasivos corrientes", "current liabilities"],
    },
    "deuda_total": {
        "label": "Deuda total",
        "aliases": ["deuda total", "deuda", "pasivo total", "total debt", "total liabilities"],
    },
    "ventas": {"label": "Ventas", "aliases": ["ventas", "ingresos", "revenue", "sales"]},
    "beneficio_neto": {
        "label": "Beneficio neto",
        "aliases": ["beneficio neto", "resultado neto", "net income", "net profit"],
    },
    "activos_totales": {
        "label": "Activos totales",
        "aliases": ["activos totales", "activo total", "total assets"],
    },
}


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


ALIAS_TO_FIELD = {
    normalize(alias): key for key, item in FIELDS.items() for alias in item["aliases"]
}
ALIAS_TO_FIELD.update({normalize(item["label"]): key for key, item in FIELDS.items()})


def parse_number(value: Any) -> float | None:
    if pd.isna(value) or str(value).strip() == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return number if pd.notna(number) else None
    raw = str(value).strip().replace("€", "").replace("$", "").replace("%", "").replace(" ", "")
    # Admite 1.234,56 (ES) y 1,234.56 (EN), además de decimales sencillos.
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        raw = raw.replace(",", ".")
    try:
        number = float(raw)
        return number if pd.notna(number) else None
    except ValueError:
        return None


def load_financial_file(uploaded_file) -> dict[str, Any]:
    name = uploaded_file.name.lower()
    if name.endswith(".csv"):
        raw = uploaded_file.getvalue()
        try:
            frame = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding="utf-8-sig")
        except UnicodeDecodeError:
            frame = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding="latin-1")
    elif name.endswith(".xlsx"):
        frame = pd.read_excel(uploaded_file)
    else:
        raise ValueError("Formato no admitido. Sube un archivo CSV o Excel (.xlsx).")

    if frame.empty:
        raise ValueError("El archivo no contiene filas.")

    values: dict[str, Any] = {key: None for key in FIELDS}
    # Formato ancho: una fila de datos y columnas con nombres de partidas.
    if len(frame) >= 1:
        for column in frame.columns:
            field = ALIAS_TO_FIELD.get(normalize(column))
            if field:
                values[field] = frame.iloc[0][column]

    # Formato largo: columnas Partida/Valor (acepta varias filas).
    normalized_columns = {normalize(column): column for column in frame.columns}
    item_col = next((normalized_columns[c] for c in ("partida", "concepto", "item", "account") if c in normalized_columns), None)
    value_col = next((normalized_columns[c] for c in ("valor", "importe", "value", "amount") if c in normalized_columns), None)
    if item_col and value_col:
        for _, row in frame.iterrows():
            field = ALIAS_TO_FIELD.get(normalize(row[item_col]))
            if field:
                values[field] = row[value_col]

    parsed = {key: parse_number(value) for key, value in values.items()}
    invalid = [FIELDS[key]["label"] for key, value in values.items() if value is not None and str(value).strip() and parsed[key] is None]
    return {"values": parsed, "invalid": invalid}


def calculate_ratios(values: dict[str, float | None]) -> list[dict[str, Any]]:
    def ratio(key: str, numerator: str, denominator: str, formula: str, multiplier: float = 1.0):
        n, d = values[numerator], values[denominator]
        if n is None or d is None:
            return {"name": key, "value": None, "formula": formula, "detail": "Faltan datos para calcular este indicador."}
        if d == 0:
            return {"name": key, "value": None, "formula": formula, "detail": "El denominador es cero; el ratio no se puede calcular."}
        result = (n / d) * multiplier
        return {"name": key, "value": result, "formula": formula, "detail": None}

    return [
        ratio("Liquidez corriente", "activo_corriente", "pasivo_corriente", "Activo corriente ÷ Pasivo corriente"),
        ratio("Deuda sobre activos", "deuda_total", "activos_totales", "Deuda total ÷ Activos totales", 100),
        ratio("Margen neto", "beneficio_neto", "ventas", "Beneficio neto ÷ Ventas", 100),
        ratio("Rentabilidad sobre activos (ROA)", "beneficio_neto", "activos_totales", "Beneficio neto ÷ Activos totales", 100),
    ]


def explain(item: dict[str, Any], values: dict[str, float | None]) -> str:
    if item["value"] is None:
        return item["detail"]
    labels = {
        "Liquidez corriente": ("activo_corriente", "pasivo_corriente"),
        "Deuda sobre activos": ("deuda_total", "activos_totales"),
        "Margen neto": ("beneficio_neto", "ventas"),
        "Rentabilidad sobre activos (ROA)": ("beneficio_neto", "activos_totales"),
    }
    a, b = labels[item["name"]]
    va, vb = values[a], values[b]
    if item["name"] == "Liquidez corriente":
        return f"{FIELDS[a]['label']} ({va:,.2f}) ÷ {FIELDS[b]['label']} ({vb:,.2f}) = {item['value']:.2f}. Indica cuántas unidades de activo corriente hay por cada unidad de pasivo corriente."
    return f"{FIELDS[a]['label']} ({va:,.2f}) ÷ {FIELDS[b]['label']} ({vb:,.2f}) × 100 = {item['value']:.2f}%. Mide la proporción indicada por este ratio; debe interpretarse según el sector y el periodo."


st.title("📊 Analizador financiero")
st.caption("Prototipo académico · Cálculos transparentes a partir de balances y cuentas de resultados")
st.info("Los resultados son orientativos. No sustituyen un análisis financiero completo ni tienen en cuenta diferencias entre sectores, periodos o criterios contables.")

with st.sidebar:
    st.header("1 · Carga los datos")
    uploaded = st.file_uploader("Archivo CSV o Excel", type=["csv", "xlsx"])
    st.caption("Puedes usar el archivo de ejemplo incluido. Se acepta una fila con una columna por partida o una tabla con columnas Partida y Valor.")

if uploaded:
    try:
        loaded = load_financial_file(uploaded)
        initial = loaded["values"]
    except Exception as error:
        st.error(f"No se pudo leer el archivo: {error}")
        initial = {key: None for key in FIELDS}
        loaded = {"invalid": []}
else:
    st.write("Carga un archivo o empieza con las cifras de ejemplo. Puedes editar las cifras antes de analizar.")
    initial = {
        "activo_corriente": 125000.0,
        "pasivo_corriente": 80000.0,
        "deuda_total": 180000.0,
        "ventas": 320000.0,
        "beneficio_neto": 24000.0,
        "activos_totales": 400000.0,
    }
    loaded = {"invalid": []}

if loaded["invalid"]:
    st.warning("No se pudieron interpretar estas cifras: " + ", ".join(loaded["invalid"]) + ". Revísalas o edítalas en la tabla.")

st.subheader("2 · Revisa los datos reconocidos")
editable = pd.DataFrame(
    [{"Partida": FIELDS[key]["label"], "Valor": initial[key]} for key in FIELDS]
)
edited = st.data_editor(
    editable,
    hide_index=True,
    width="stretch",
    num_rows="fixed",
    column_config={
        "Partida": st.column_config.TextColumn(disabled=True),
        "Valor": st.column_config.NumberColumn("Valor", format="%.2f", step=1000.0),
    },
    key="financial_values",
)
values = {
    key: parse_number(edited.iloc[index]["Valor"])
    for index, key in enumerate(FIELDS)
}
missing = [FIELDS[key]["label"] for key, value in values.items() if value is None]
if missing:
    st.warning("Datos pendientes: " + ", ".join(missing) + ". Los indicadores que dependan de ellos no se calcularán.")

st.subheader("3 · Indicadores")
ratios = calculate_ratios(values)
columns = st.columns(4)
for column, item in zip(columns, ratios):
    shown = "Pendiente" if item["value"] is None else (f"{item['value']:.2f}" if item["name"] == "Liquidez corriente" else f"{item['value']:.2f}%")
    column.metric(item["name"], shown)

for item in ratios:
    with st.expander(f"{item['name']} · {item['formula']}", expanded=True):
        st.write(explain(item, values))

st.divider()
st.caption("Método: fórmulas financieras explícitas y explicaciones trazables. Esta versión no extrae automáticamente texto de PDF ni usa un modelo generativo; la IA se puede añadir después para redactar explicaciones a partir de estos resultados verificados.")
