# Carril · ratios financieros con la fuente a la vista

Proyecto de la asignatura **Análisis de servicio financiero** (5.º curso, «El carril abierto»).
Equipo: Javier López-Montenegro, Alejandro Torres y Bruno Ribeiro.

Introduces un ticker y la web descarga los estados financieros anuales de la empresa. Después:

- Calcula **13 ratios** en cinco dimensiones: liquidez, deuda, actividad, rentabilidad y flujo de caja. También hace el **DuPont** y el **Altman Z-score**.
- **Contrasta las cifras con el 10-K** presentado en la SEC, que es la fuente primaria.
- Compara cada ratio con la **mediana de su sector**.

Cada cifra enseña su fórmula y de dónde sale. Si falta un dato, el ratio queda «Pendiente»: la web nunca se inventa un valor.

> No es asesoramiento financiero. Los ratios necesitan contexto sectorial y contable.

## Qué hace

| Parte | Detalle |
|---|---|
| Datos | Yahoo Finance (fundamentals-timeseries): balance, resultados, flujos de caja y capitalización histórica de cada cierre anual. |
| Ratios | Corriente, rápido, deuda/patrimonio, deuda/activos, cobertura de intereses, deuda neta/EBITDA, rotación de inventarios, rotación de activos, margen operativo, ROA, ROE, cobertura de deuda por flujo operativo y FCF yield. |
| Casos límite | Con patrimonio negativo, D/E, ROE y DuPont no se interpretan. Una deuda neta negativa se muestra como «caja neta». El FCF calculado se contrasta con el publicado. |
| Verificación SEC | Partida a partida frente al 10-K (EDGAR, us-gaap), con una tolerancia del 0,5 % y un enlace a cada expediente. Opcionalmente, rellena los huecos de Yahoo. |
| Sector | Mediana y rango P25–P75 de un grupo de comparables. Con menos de 3 valores no se calcula. |

## Estructura

```
public/     Web estática (HTML, CSS y módulos JS compartidos con el servidor)
  finance.mjs   Fórmulas de los ratios, DuPont, Altman y avisos
  verify.mjs    Extracción y comparación con el 10-K
  peers.mjs     Grupos de comparables y estadística
api/        Funciones de Vercel: /api/financials, /api/sec, /api/peers
lib/        Descarga de Yahoo y de la SEC, con caché y control de errores
tests/      Pruebas con datos reales guardados (tests/fixtures)
prototipo-streamlit/   Primera versión (CSV/Excel + Streamlit)
docs/       Propuesta del proyecto
BITACORA.md Decisiones, errores detectados y verificación
```

## Ejecutar en local

Requiere Node 20 o superior. No hay dependencias que instalar.

```bash
npm test          # 24 pruebas
npx vercel dev    # web y funciones en http://localhost:3000
```

## Publicar en Vercel

1. En vercel.com: **Add New → Project → Import** este repositorio. No hay que cambiar nada: `vercel.json` ya indica que la web está en `public/` y que las funciones están en `api/`.
2. En **Settings → Environment Variables**, añade `SEC_USER_AGENT` con un nombre y un correo de contacto, por ejemplo `CarrilAbierto equipo@ejemplo.com`. La SEC lo exige para usar su API.
3. Despliega.

## Uso de inteligencia artificial

- Las primeras versiones de la web se desarrollaron con ChatGPT/Codex. Las mejoras de noviembre (flujo de caja, casos límite, verificación con la SEC y comparación sectorial) se hicieron con Claude (Anthropic).
- La IA se usó para escribir código y documentación. Ningún cálculo depende de un modelo generativo: todas las fórmulas son código determinista y están probadas.
- Las decisiones, los errores detectados y su contraste con fuentes primarias están en [BITACORA.md](BITACORA.md).
