# Informe final · Carril Abierto

> Versión en Markdown del informe final entregado en Word. El contenido es el mismo que el del documento final.

**Equipo:** Javier López-Montenegro, Alejandro Torres y Bruno Ribeiro

**Repositorio:** github.com/Javil0/carril-abierto · **Web:** https://carril-abierto.vercel.app

## 1. ¿Qué queríamos hacer y qué hicimos?

**La propuesta (24/09).** Una web en la que el usuario subiera el balance y la cuenta de resultados en PDF o Excel. La IA extraería las partidas, la web calcularía ratios con una puntuación por área (liquidez, solvencia, rentabilidad y eficiencia) y la IA explicaría el resultado en lenguaje claro.

**Lo que entregamos.** A partir de un ticker (AAPL, ITX.MC…), la web descarga de Yahoo Finance los estados anuales y calcula 13 ratios en cinco dimensiones (liquidez, deuda, actividad, rentabilidad y flujo de caja), el DuPont y el Altman Z-score. Cada cifra muestra su fórmula y su origen.

|                      | **Propuesta**          | **Resultado**                                                            |
|----------------------|------------------------|--------------------------------------------------------------------------|
| **Entrada de datos** | Subir PDF o Excel      | Escribir un ticker                                                       |
| **Extracción**       | La IA lee el documento | Datos estructurados de Yahoo Finance, contrastados con el 10-K de la SEC |
| **Cálculo**          | Ratios por área        | 13 ratios en cinco dimensiones, DuPont y Altman                          |
| **Evaluación**       | Puntuación por área    | Comparación con la mediana y el rango P25–P75 del sector                 |
| **Explicación**      | Texto generado por IA  | Reglas de código: fórmula, datos y lectura de cada ratio                 |
| **Valoración**       | No estaba prevista     | DCF por FCFF con supuestos editables                                     |

**Qué cambió y por qué.**

1.  **De subir documentos a buscar por ticker (20/10).** Llegamos a construir un prototipo en Streamlit que leía CSV y Excel (el PDF no llegó a probarse). El ticker eliminaba casi toda la fricción y las cifras llegan estructuradas: el riesgo pasa de «leer mal un número» a «que la fuente defina la partida de otra manera», y eso se controla con el 10-K (decisión 1).

2.  **Sin IA dentro de la web.** El uso por API no entra en las suscripciones de Claude ni de ChatGPT: cada consulta tendría coste. Todo son reglas deterministas y probadas, así que el mismo dato da siempre el mismo resultado. La IA se usó para desarrollar la web, no dentro de ella.

3.  **De una puntuación por área a la comparación con el sector.** Una nota general no significaría nada (una rotación de inventarios de 5× es alta para una petrolera y baja para un supermercado), y una nota por sector exigía fijar a mano umbrales sin base. Cada ratio se compara con la mediana y el rango P25–P75 de sus comparables, sin convertirlo en nota (decisión 2).

4.  **Punto de control (22/10).** Se añadieron FCF yield, cobertura de deuda por flujo operativo y deuda neta/EBITDA; con patrimonio negativo (McDonald's: −1.790 M$) la D/E, el ROE y el DuPont quedan «Pendiente», y con deuda neta negativa (Alphabet) se etiqueta «caja neta».

5.  **Valoración DCF.** La web estima también cuánto vale la empresa, con un DCF por FCFF (decisión 3).

**Qué se mantiene de la propuesta.** Un dato que falta se marca «Pendiente» y nunca se rellena con cero ni con una estimación. Cada ratio enseña su fórmula y sus partidas de origen. Y comprobar los cálculos «con ejemplos calculados manualmente» se ha convertido en 36 pruebas automáticas con datos reales.

## 2. Las tres decisiones importantes y lo que descartamos

### Decisión 1 · Buscar por ticker en lugar de subir las cuentas

**Qué decidimos y por qué.** La web descarga de Yahoo Finance el balance, la cuenta de resultados, los flujos de caja y la capitalización de cada cierre anual. Elimina la fricción del prototipo (buscar, descargar, formatear y subir las cuentas), las cifras llegan estructuradas con su fecha y su moneda, y permite comparar con el sector sin que el usuario suba las cuentas de los competidores.

**Qué costó y cómo lo controlamos.**

- **Yahoo no es una fuente primaria:** cada partida se contrasta con el 10-K de la SEC (API de EDGAR) con una tolerancia del 0,5 %.

- **El EBIT de Yahoo no es el resultado operativo:** en Alphabet (2025), 159.562 M$ frente a 129.039 M$ en el 10-K, porque Yahoo parte del resultado antes de impuestos e incluye ingresos financieros. Lo mantuvimos por ser la única definición disponible para todas las empresas, también las europeas; renombramos el ratio a «margen EBIT» y la pestaña de verificación muestra la diferencia.

- **A veces faltan datos:** el ratio queda «Pendiente» y se explica por qué. Si el hueco existe en el 10-K, el usuario puede completarlo de forma visible y reversible; si se puede reconstruir con partidas del mismo cierre (EBITDA = EBIT + amortizaciones), se marca como «derivado» con su fórmula.

**Qué descartamos.** Leer PDF con IA (una cifra mal leída cambia todos los ratios, es difícil de detectar y la extracción tenía coste por consulta); seguir con la subida de CSV o Excel (obligaba a preparar los datos e impedía comparar con el sector), y tomar Yahoo como verdad (no habríamos detectado diferencias como la del EBIT).

### Decisión 2 · Comparar con el sector en lugar de puntuar

**Qué decidimos.** Cada ratio se compara con la mediana y el rango P25–P75 de un grupo de comparables: 30 grupos definidos (Ibex 35, Euro Stoxx 50 y grandes cotizadas de EE. UU.), con 247 tickers. El usuario elige el grupo, se usa el ejercicio de cada comparable más cercano al de la empresa (máximo 12 meses de diferencia) y con menos de 3 valores no se publica mediana.

**Por qué.** Un ratio solo se entiende frente a su sector. La mediana, y no la media, porque la media se dispara con extremos como un ROE del 140 % o una rotación de inventarios de 195×. Los comparables con el ratio pendiente se excluyen y la web dice cuáles: en restauración, SBUX, YUM y DPZ tienen patrimonio negativo, así que la mediana del ROE de McDonald's sale solo de CMG, DRI y QSR.

**Qué descartamos.** La puntuación por área de la propuesta; las «recomendaciones» de Yahoo, que proponen empresas seguidas por los mismos inversores y no del mismo sector (para Inditex, Iberdrola, Repsol y ACS), y que el usuario escriba su propia lista, porque no podríamos justificar ningún grupo.

### Decisión 3 · Añadir una valoración DCF con todos los supuestos a la vista

**Qué decidimos.** La pestaña «Valoración DCF» descuenta al WACC el FCFF = EBIT × (1 − t) + amortizaciones − capex − inversión en circulante, con 5 años de proyección y un valor terminal por crecimiento a perpetuidad (Gordon) o por múltiplo EV/EBITDA. Los supuestos parten de la media de los tres últimos ejercicios o de una fuente citada, son editables (quedan marcados como «supuesto del usuario») y una tabla de sensibilidad cruza WACC y crecimiento.

**La beta, el parámetro más delicado.** Se parte de la beta desapalancada de la industria en las tablas de Aswath Damodaran (NYU Stern, actualización del 05/01/2026), y se reapalanca con la deuda/patrimonio de mercado de la empresa: βL = βU × \[1 + (1 − t) × D/E\]. Un aviso aclara que es una estimación (supone el riesgo medio del sector y un endeudamiento constante), no una regresión de la cotización. Las primas de riesgo de mercado y país también salen de Damodaran; el tipo libre de riesgo, del Treasury a 10 años (USD) o de la curva AAA del BCE (EUR).

**Qué descartamos.** La beta de Yahoo (exige un token, depende de la ventana de regresión y es muy ruidosa por empresa); reapalancar con el tipo impositivo efectivo, porque Damodaran desapalanca con el marginal (25 % en EE. UU; valorar bancos y aseguradoras por FCFF (la web explica por qué no y remite al modelo de exceso de rentabilidad sobre el patrimonio), y dar una única cifra con supuestos fijos.

**Ejemplo (McDonald's, 25/11/2026).** La beta desapalancada de restauración (0,767), reapalancada con una deuda/patrimonio de mercado de 0,274, da una beta de 0,925, un coste del capital propio del 8,96 % y un WACC del 7,54 %. Resultado: 192 $ por acción con Gordon al 2 % y 305 $ con el múltiplo medio de su industria, frente a una cotización de 281 $. El valor terminal pesa el 77 % del valor de empresa, y la web enseña esa sensibilidad.

## 3. ¿Dónde falló la máquina?

### Caso 1 · Agrupó a Inditex por índice bursátil y no por sector

- **Qué nos dijo.** En el primer reparto de comparables (14 grupos), la IA metió a Inditex en un grupo del Ibex con Repsol, Aena y Telefónica y lo presentó como su grupo sectorial.

- **Cómo lo detectamos.** Probando tickers: la rotación de inventarios y el margen de Inditex se comparaban con empresas casi sin inventario o con otra estructura de costes, y las etiquetas «por encima» o «por debajo del rango» no tenían sentido.

- **Corrección.** Nuevo grupo «Moda y distribución textil» (H&M, TJX, Ross, Gap, Lululemon, Nike y Adidas). Como los ratios no tienen unidades, H&M es comparable aunque presente sus cuentas en coronas suecas.

### Caso 2 · Dio por inexistentes datos que Yahoo sí tiene

- **Qué nos dijo.** El código de la IA interpretaba «la serie llega vacía» como «el dato no existe», y lo dio por correcto porque las pruebas pasaban: Iberdrola aparecía sin EBIT, ASML sin flujo de caja operativo y varios ratios quedaban pendientes sin motivo.

- **Cómo lo detectamos.** Comparando la web publicada con Yahoo Finance en el navegador: al servidor de Vercel (Washington) Yahoo le devolvía vacías series que en el navegador sí aparecen.

- **Corrección.** Si falta una partida, se calcula con otras del mismo ejercicio y moneda (EBIT = resultado antes de impuestos + gasto por intereses; flujo operativo = FCF + capex; EBITDA = EBIT + amortizaciones), se marca como «derivada» en «Datos brutos» y nunca sustituye una cifra publicada. El EBIT reconstruido coincide con el de Yahoo en Iberdrola, Inditex, McDonald's, Repsol y Telefónica, y el EBITDA de Iberdrola (10.270 + 6.493 = 16.763 M€) con el publicado; quedó como prueba.

### Caso 3 · Propuso que el usuario introdujera la beta a mano

- **Qué nos dijo.** Al diseñar el DCF, la IA propuso que el usuario introdujera la beta, el tipo libre de riesgo, la prima de riesgo de mercado y el coste de la deuda. Sobre la beta: «Es más honesto que el usuario la introduzca e indique su fuente.»

- **Cómo lo detectamos.** Revisando el plan: el usuario no tiene una beta a mano, dos usuarios obtendrían valores distintos y el DCF sería una calculadora vacía.

- **Fuente primaria.** Las tablas de betas por industria de Damodaran (betas.xls, betaEurope.xls y betaGlobal.xls, 05/01/2026), con la beta media, la D/E de mercado, el tipo impositivo y la beta desapalancada de cada industria.

- **Corrección.** La web toma la beta desapalancada de la industria y la reapalanca con la deuda/patrimonio de mercado de la empresa; el usuario puede cambiarla, pero parte de una cifra con fuente. Al verificar la fórmula vimos que Damodaran usa el tipo **marginal**, no el efectivo que proponía la IA; con él se recupera la beta publicada en las 288 filas.

## 4. ¿Qué haríamos distinto?

- **Pedir a la IA varios planes antes de empezar.** Comparar desde el principio dos o tres planes (subir documentos, ticker, base de datos) nos habría ahorrado el prototipo de Streamlit.

- **No aceptar cambios sin pruebas.** El 22/10 el Altman pasó a calcularse automáticamente sin ejecutar pruebas, también para bancos; hoy la web avisa en banca, seguros e inmobiliario, pero debió decidirse y probarse en el mismo cambio. Desde noviembre cada cambio llega con su prueba: hay 36 con datos reales (el FCF calculado de McDonald's coincide con el publicado, 7.186 M$).

- **Pedir a la IA que justifique cada parámetro.** Ninguno de los tres errores del apartado 3 era de cálculo: eran datos y decisiones de diseño presentados como obvios. Ahora le pedimos fuente y alternativa para cada uno.

- **Pensar en quien usa la web, no solo en el cálculo.** Una fórmula correcta no basta si el usuario no puede usarla (caso 3). Una auditoría de legibilidad encontró 68 tipos de texto por debajo de 12 px y 89 con poco contraste, y en el móvil la tabla de ratios escondía la mediana del sector. Debimos revisarla como usuario desde el principio.

**Alcance.** La verificación automática con la fuente primaria cubre las empresas que presentan un 10-K ante la SEC. Para emisores españoles como Inditex o Santander, la fuente primaria son sus cuentas en la CNMV. La web lo indica, pero ese contraste queda fuera del proyecto.

*Uso de IA:* ChatGPT/Codex (prototipo y primeras versiones de la web) y Claude (flujo de caja, casos límite, verificación con la SEC, comparables, DCF, auditoría y redacción de este informe). La IA escribió código y documentación. Ningún cálculo de la web depende de un modelo generativo: todas las fórmulas son código determinista con pruebas. Las decisiones del apartado 2 son del equipo.
