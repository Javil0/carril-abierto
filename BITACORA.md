# Bitácora del proyecto

## 20 de octubre de 2026 — Primera versión del prototipo

### Qué quería hacer y qué hice

La propuesta inicial planteaba una web que recibiera balances y cuentas de resultados, extrajera sus partidas y usara IA para interpretarlas. Para tener algo demostrable con poco margen, implementé una aplicación local que carga CSV y Excel estructurados, permite revisar y corregir las cifras, y calcula cuatro indicadores con fórmulas explícitas.

### Decisiones importantes

1. **Empezar por CSV/Excel estructurado.** Se pospuso la extracción desde PDF porque tablas y formatos heterogéneos podrían provocar errores difíciles de detectar en una demo rápida.
2. **Separar cálculo e interpretación.** Los ratios se calculan con código determinista. La versión actual usa explicaciones basadas en reglas y no llama a un modelo generativo.
3. **No completar datos ausentes.** Si falta una cifra o el denominador es cero, el ratio se muestra como pendiente.

### Qué puede fallar y cómo lo comprobaré

- Un nombre de columna no reconocido puede dejar una partida vacía. Lo detectaré comprobando la tabla de revisión antes de aceptar el resultado.
- Una cifra con separadores ambiguos puede interpretarse mal. Compararé el valor extraído con la cifra visible en el archivo original.
- Un ratio correcto puede parecer bueno o malo sin contexto. Revisaré la fórmula y las cifras usadas; la demo no asigna puntuaciones ni hace comparaciones sectoriales.

### Limitación y siguiente paso

La aplicación todavía no usa IA para redactar; las explicaciones son plantillas trazables. El siguiente paso sería incorporar una explicación generativa opcional que reciba solo los ratios calculados, manteniendo las fórmulas fuera del modelo y registrando cada discrepancia frente a las cuentas originales.

### Registro de errores de IA

En esta primera versión no se usó un modelo generativo para extraer cifras o interpretar resultados. Por tanto, todavía no hay errores de IA que documentar. En la siguiente iteración se anotarán tres casos concretos con la respuesta del modelo y la fuente primaria utilizada para contrastarla.

## 20 de octubre de 2026 — Consulta automática por ticker en Sites

La propuesta de Sites se convirtió en una aplicación con servidor: introducir un ticker consulta el balance y la cuenta de resultados anuales de Yahoo Finance. El usuario puede elegir el ejercicio, revisar o editar seis partidas y descargar los datos en CSV y el informe en texto. Las cifras conservan la moneda original y se muestran en unidades completas; el gráfico etiqueta expresamente su escala en millones cuando corresponde.

Se decidió consultar Yahoo desde el servidor para evitar depender del acceso entre dominios del navegador. Una llamada directa con curl recibió un HTTP 429; la descarga con yfinance funcionó y una prueba con fetch desde JavaScript también funcionó. No fue necesario contratar una API ni conectar un modelo generativo.

Las decisiones financieras principales fueron usar TotalDebt como deuda financiera, no sustituirla por pasivo total; emparejar balance y resultados de la misma fecha y moneda; e identificar el ROA calculado con activos al cierre como una aproximación. Un dato ausente o un denominador cero deja el indicador pendiente. En Santander, la fuente no devuelve las partidas corrientes habituales: la liquidez queda pendiente.

Se comprobaron consultas reales de AAPL, MSFT y SAN.MC, el cambio de ejercicio de AAPL en el navegador y la descarga de su CSV. Seis pruebas automatizadas cubren fórmulas, fechas, monedas, datos faltantes, cero, validación del ticker y el error 429. El endpoint privado publicado devolvió HTTP 200 y los ratios de AAPL. La disponibilidad futura depende de Yahoo y sus límites. Esto documenta errores de integración y decisiones de diseño, no constituye todavía tres errores de interpretación cometidos por un modelo de IA.

## 20 de octubre de 2026 — Site funcional desde el template Carril CFA Balance

El template se adaptó a un nuevo Site privado con un inicio por ticker y una página de análisis con pestañas de ratios, balance y datos brutos. Se incorporaron diez ratios, DuPont y Altman clásico. Se mantuvo la fuente del template personal como referencia independiente.

La lógica financiera se comparte entre servidor y navegador. Los promedios requieren un cierre anterior comparable de la misma moneda. ROE y DuPont usan beneficio y patrimonio ordinarios; la deuda financiera se distingue del pasivo total. Altman usa capitalización histórica del periodo, y su interpretación requiere que el analista seleccione que la versión industrial cotizada es aplicable.

Se verificaron ocho pruebas de cálculo y validación, consultas reales de AAPL, MSFT y Santander, las pestañas del navegador y el ejercicio más antiguo con ratios pendientes por falta de saldo inicial. Yahoo no devolvió el gasto de intereses de Apple en el último ejercicio: se dejó pendiente en vez de inventar un importe. La publicación respondió HTTP 200 para MSFT con diez ratios disponibles y DuPont. La fuente puede limitar solicitudes y su disponibilidad no está garantizada.

Publicación: https://carril-cfa-balance.handywood33.chatgpt.site

## 22/10/2026 · Altman automático
- Petición: calcular Altman sin confirmar manualmente el tipo de empresa.
- Cambio: se elimina el selector y el bloqueo de aplicabilidad; el total y sus cinco componentes se calculan automáticamente cuando hay datos suficientes.
- Si faltan cifras del mismo periodo o el denominador no es válido, sigue pendiente y se explica la causa.
- Se mantiene la descripción de la versión clásica industrial y su limitación sectorial.
- Compilación completada y versión 2 publicada en https://carril-cfa-balance.handywood33.chatgpt.site. No se ejecutaron pruebas en este cambio.

## 06/11/2026 · Mejoras tras el punto de control
- Origen: respuesta del profesor (23/10) al punto de control. Pedía métricas de flujo de caja libre (FCF yield, cobertura de deuda por flujo operativo) y vigilar los casos de fondos propios negativos y deuda neta negativa.
- Nuevas partidas de Yahoo: OperatingCashFlow, CapitalExpenditure, FreeCashFlow y EBITDA.
- Tres ratios nuevos (de 10 a 13) y una quinta dimensión, «Flujo de caja»:
  - **FCF yield** = (flujo operativo − |capex|) / capitalización del mismo cierre. Yahoo publica el capex en negativo, así que se usa el valor absoluto para que el resultado no dependa del signo de la fuente.
  - **Cobertura de deuda por flujo operativo** = flujo operativo / deuda financiera. Si no hay deuda, queda como «Sin deuda financiera» en lugar de dividir entre cero.
  - **Deuda neta / EBITDA**, con deuda neta = deuda financiera − (efectivo + inversiones corrientes).
- Patrimonio negativo: D/E, ROE y DuPont quedan pendientes y se explica el motivo. El ROE también queda pendiente si cualquiera de los dos cierres usados en el promedio es negativo, porque la media podría salir positiva y ocultarlo. Se muestra un aviso en cabecera y el gráfico de financiación lo explica en lugar de dibujar porcentajes sin sentido.
- Deuda neta negativa: el ratio sale negativo y se etiqueta como «caja neta». Es holgura, no un apalancamiento más bajo.
- Control: el FCF calculado se contrasta con el FreeCashFlow publicado por Yahoo y se avisa si la diferencia supera el 1 %.
- Nueva tabla «Lo que genera en caja» en la pestaña Balance.
- Verificación: 14 pruebas superadas (8 anteriores y 6 nuevas). Dos de ellas usan datos reales de Yahoo guardados en `tests/fixtures`:
  - McDonald's 2025: patrimonio de −1.790 M$, FCF yield del 3,31 %, deuda neta/EBITDA de 3,68× y FCF calculado igual al publicado (7.186 M$).
  - Alphabet 2025: caja neta de 67.552 M$ y deuda neta/EBITDA de −0,37×.
- La interfaz se revisó con capturas en un servidor local con esos datos.
- Pendiente: volver a publicar el Site desde la herramienta de Sites. La compilación completa no se pudo ejecutar fuera del Mac porque `node_modules` contiene binarios nativos de macOS.

## 06/11/2026 · Revisión de botones
- Se comprobaron de forma automática (Playwright) todos los controles: navegación, ticker, sugerencias, 6 filtros, 13 ratios (nombre y ↗), Altman, CSV, selector de ejercicio, pestañas (también con teclado), buscador, Método, cierre del diálogo y enlaces a Yahoo.
- Errores corregidos:
  - El texto «Ver fórmula y datos» de las tarjetas KPI no respondía. Ahora cada tarjeta abre la fórmula de su ratio.
  - La etiqueta «↗ Cada fórmula, a la vista» parecía un botón y no hacía nada. Ahora abre el Método.
  - «···» en «Qué financia el activo» era decorativo. Ahora lleva a la pestaña Balance.
  - «Datos que puedes revisar ↗» en la portada no hacía nada. Ahora abre el Método.
  - «Análisis» sin ticker dejaba la dirección atascada en #/analisis y un segundo clic no hacía nada. Ahora vuelve al inicio y pide un ticker.

## 06/11/2026 · Ajustes de legibilidad
- Gráfico «Cómo evoluciona el negocio» más estrecho y «Qué financia el activo» más grande (donut de 145 a 220 px).
- Texto pequeño ampliado: tabla de ratios, fórmulas, notas, pestañas, filtros, balance, datos brutos y diálogos.
- DuPont con cifras más grandes (de 24 a 44 px) para que encajen con su recuadro; Altman también más grande.
- Comprobado a 1440, 1000 y 390 px de ancho sin desbordamiento horizontal.

## 06/11/2026 · Contraste con la SEC y comparación sectorial
### Verificación con fuente primaria (pestaña «Verificación SEC»)
- Cada partida de Yahoo se compara con el 10-K presentado en EDGAR (API companyfacts, taxonomía us-gaap) para el mismo cierre.
- Decisiones:
  - Tolerancia del 0,5 % para redondeos.
  - Hasta 10 días de diferencia de fecha, porque Yahoo lleva el cierre de Apple del 26/09 al 30/09.
  - Solo hechos anuales de formularios 10-K; se descartan los trimestres.
  - Si un 10-K posterior reexpresa una cifra, se usa la más reciente.
  - El pasivo total se deriva (pasivo y patrimonio − patrimonio) cuando la empresa no lo etiqueta, como ocurre en MCD.
- «Completar huecos» solo rellena datos que falten en Yahoo, nunca sustituye una cifra existente. Es visible (aviso y estado «sec» en Datos brutos) y reversible. El contraste se descarga en CSV con enlace a cada 10-K.
- Fuera de alcance: emisores no estadounidenses (SAN.MC → habría que usar la CNMV) y empresas que presentan el 20-F con IFRS.
- Hallazgos con datos reales (consulta del 6/11/2026):
  1. **El EBIT de Yahoo no es el resultado operativo del 10-K.** Alphabet 2025: 159.562 M frente a 129.039 M (+23,7 %). Yahoo parte del resultado antes de impuestos e incluye ingresos financieros. Con el 10-K, el «margen operativo» de la web pasaría del 39,6 % al 32,0 %. Se marca como «definición distinta», no como error.
  2. **Apple no publica el gasto por intereses en sus 10-K de 2025 y 2026** (no aparece ninguna etiqueta InterestExpense). La cobertura de intereses pendiente no es un fallo de Yahoo, sino que el dato no está en la fuente primaria.
  3. **MCD: el patrimonio difiere en 1 M** (−1.790 M en Yahoo frente a −1.791 M en el 10-K). La causa es la participación minoritaria; queda dentro de la tolerancia.
  - Las demás partidas de MCD y GOOGL coinciden exactamente.
- Pendiente antes de publicar: la SEC exige identificarse en el User-Agent. Hay que poner el correo del equipo en `lib/sec.mjs` (SEC_USER_AGENT).

### Comparación sectorial (columna «Sector (mediana)» y ventana de cada ratio)
- Grupos de comparables definidos por el equipo (14 grupos en `src/peers.mjs`). El usuario puede escribir su propia lista.
- Para cada ratio se calcula la mediana y el rango intercuartílico (P25–P75) con las mismas fórmulas, usando el ejercicio de cada comparable más cercano al de la empresa (máximo 200 días).
- Decisiones:
  - Se usan la mediana y los cuartiles, no la media, porque la media es muy sensible a valores extremos (un ROE de 140 % o una rotación de inventario de 195×).
  - Sin al menos 3 valores no se publica mediana.
  - Los comparables con un ratio pendiente (por ejemplo, un ROE con patrimonio negativo) se excluyen de esa estadística.
  - «Por encima» o «por debajo» del rango es descriptivo, no una nota.
- Caso real: en el grupo de restauración de MCD, SBUX, YUM y DPZ también tienen patrimonio negativo. La mediana del ROE se calcula solo con CMG, DRI y QSR (47,4 %), y la ventana del ratio indica qué empresas se excluyen y por qué.
- Verificación: 22 pruebas superadas (8 nuevas), con extractos reales de la SEC y de Yahoo en `tests/fixtures`. Revisión de botones y del diseño a 1440 y 390 px sin errores.

## 08/11/2026 · Ajustes de interfaz
- Letra más grande en la portada, en «Cambiar empresa», en la cabecera de análisis (ejercicio, descarga, fuente) y en el aviso naranja.
- Se quita de la interfaz el formulario para elegir comparables a mano: la comparación sectorial usa solo los grupos definidos por el equipo, que se pueden justificar en la bitácora. El servidor conserva la opción, pero ya no se usa.
- Tabla de ratios: +1 px en cabeceras (11), nombres (14), categorías (11), valores y medianas (16), etiquetas de rango (10) y lectura (13).
- Sugerencias de la portada: NVDA (NVIDIA), GOOGL (Alphabet) y SAN.MC (Santander); ticker inicial NVDA.

## 08/11/2026 · Inditex en la portada, GitHub y Vercel
- Los ejemplos de la portada pasan a ser Inditex (ITX.MC), Alphabet (GOOGL) y Santander (SAN.MC). Inditex tiene en Yahoo todas las partidas que usan los ratios; su ejercicio cierra el 31 de enero y está en euros.
- Nuevo grupo de comparables «Moda y distribución textil»: H&M, TJX, Ross, Gap, Lululemon y Nike. Antes Inditex caía en un grupo del Ibex junto a Repsol, Aena o Telefónica, que no tienen un modelo de negocio comparable. Los ratios no tienen unidades, así que se pueden comparar aunque H&M informe en coronas suecas.
- Inditex no presenta 10-K, así que la pestaña de verificación explica que su fuente primaria serían las cuentas anuales depositadas en la CNMV.
- La web se separa de la plataforma de Sites de ChatGPT y se reorganiza para Vercel:
  - `public/`: la web estática.
  - `api/`: tres funciones (`financials`, `sec`, `peers`).
  - `lib/`: la lógica de servidor.
  - Sin dependencias externas: solo Node 20 o superior y `fetch`.
- El contacto para la SEC deja de estar en el código y pasa a la variable de entorno `SEC_USER_AGENT`.
- Repositorio público: github.com/Javil0/carril-abierto. Contiene la web, las pruebas, el prototipo de Streamlit de la primera versión, la propuesta y esta bitácora.
- 23 pruebas superadas (1 nueva con los datos reales de Inditex y su grupo).
