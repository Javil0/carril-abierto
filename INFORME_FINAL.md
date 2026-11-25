# Informe final · Carril Abierto

**Equipo:** Javier López-Montenegro, Alejandro Torres y Bruno Ribeiro
**Asignatura:** Análisis de servicio financiero · El carril abierto
**Repositorio:** github.com/Javil0/carril-abierto · **Web:** https://carril-abierto.vercel.app

---

## 1. ¿Qué queríamos hacer y qué hicimos?

**La propuesta (24/09).** Una web en la que el usuario subiera el balance y la cuenta de resultados de una empresa en PDF o Excel. La IA extraería las partidas, la web calcularía ratios y pondría una puntuación por área (liquidez, solvencia, rentabilidad y eficiencia), y la IA explicaría el resultado en lenguaje claro.

**Lo que entregamos.**
- **Entrada:** el usuario escribe un ticker (AAPL, ITX.MC…) y la web descarga de Yahoo Finance los estados financieros anuales de la empresa.
- **Análisis:**
  - 13 ratios en cinco dimensiones (liquidez, deuda, actividad, rentabilidad y flujo de caja), el DuPont y el Altman Z-score.
  - Cada partida se contrasta con el 10-K presentado en la SEC.
  - Cada ratio se compara con la mediana de un grupo de comparables del sector.
  - Una valoración por descuento de flujos (DCF) con todos los supuestos editables.
- **Transparencia:** cada cifra muestra su fórmula y de dónde sale.

| | Propuesta | Resultado |
|---|---|---|
| Entrada de datos | Subir PDF o Excel | Escribir un ticker |
| Extracción | La IA lee el documento | Datos estructurados de Yahoo Finance, contrastados con el 10-K de la SEC |
| Cálculo | Ratios por área | 13 ratios en cinco dimensiones, DuPont y Altman |
| Evaluación | Puntuación por área | Comparación con la mediana y el rango P25–P75 del sector |
| Explicación | Texto generado por IA | Reglas de código: fórmula, datos y lectura de cada ratio |
| Valoración | No estaba prevista | DCF por FCFF con supuestos editables |

**Qué cambió y por qué.**

1. **De subir documentos a buscar por ticker (20/10).**
   - Empezamos por la idea de la propuesta y llegamos a construir un prototipo en Streamlit (`prototipo-streamlit/`) que leía CSV y Excel. La lectura de PDF no llegamos a probarla.
   - Después vimos que buscar por ticker eliminaba casi toda la fricción. El usuario ya no tiene que descargar las cuentas, darles formato y subirlas: escribe cuatro letras y lo tiene todo.
   - Además, las cifras llegan estructuradas. El riesgo deja de ser «leer mal un número» y pasa a ser «que la fuente defina la partida de otra manera», y ese riesgo sí lo podemos controlar contrastando con la fuente primaria, el 10-K de la SEC (decisión 1).
2. **Sin IA dentro de la web.**
   - Al principio queríamos llamar a un modelo de IA desde la web para interpretar los resultados. Al mirarlo vimos que el uso por API no está incluido en las suscripciones mensuales de Claude ni de ChatGPT: cada consulta tendría un coste.
   - Decidimos hacerlo todo con código: cálculos, avisos y explicaciones son reglas deterministas y probadas.
   - La IA se ha usado para desarrollar la web, no dentro de ella. Eso tiene una ventaja: el mismo dato da siempre el mismo resultado, y cada explicación se puede rastrear hasta su regla.
3. **De una puntuación por área a la comparación con el sector.**
   - Una nota de 0 a 10 tenía dos salidas. Si era general para todas las empresas, no significaría nada: una rotación de inventarios de 5× es alta para una petrolera y baja para un supermercado. Si la adaptábamos a cada sector, tendríamos que fijar a mano umbrales para decenas de sectores sin una base que los justificara.
   - Preferimos que cada ratio se compare con lo que hacen empresas parecidas: la mediana y el rango P25–P75 de un grupo de comparables (decisión 2). Estar por encima o por debajo del rango se describe, pero no se convierte en una nota.
4. **Punto de control (22/10).**
   - El profesor señaló dos carencias: faltaban métricas de flujo de caja, y había que tratar el patrimonio neto negativo y la deuda neta negativa. Las resolvimos el 06/11.
   - Se añadieron el FCF yield, la cobertura de deuda por flujo operativo y la deuda neta/EBITDA.
   - Con patrimonio negativo (McDonald's: −1.790 M$), la deuda/patrimonio, el ROE y el DuPont quedan «Pendiente» en lugar de mostrar cifras con el signo invertido.
   - Con deuda neta negativa (Alphabet), el ratio se etiqueta como «caja neta».
5. **Valoración DCF (25/11).**
   - Si la web sirve para analizar empresas, tenía sentido que también estimara cuánto valen según los flujos de caja que generan, y no solo cómo están.
   - Se añadió un DCF por flujo de caja libre para la empresa (FCFF), con todos los supuestos editables y la beta construida a partir de las tablas de Damodaran (decisión 3).

**Qué se mantiene de la propuesta.**
- **Datos que faltan:** la propuesta decía que, si un dato faltaba o no se podía leer con seguridad, la herramienta lo marcaría para que el usuario lo revisara en lugar de asumirlo. Es el «Pendiente» de la web: nunca se rellena un hueco con cero ni con una estimación.
- **Huecos que sí existen en la fuente primaria:** se pueden completar con el 10-K, pero solo si el usuario lo pide. Siempre queda marcado y se puede deshacer.
- **Fórmulas explícitas:** se mantienen, igual que el compromiso de que el usuario vea «qué cifras explican cada conclusión». Cada ratio enseña su fórmula, el numerador, el denominador y las partidas de origen.
- **Comprobación manual:** la promesa de comprobar los cálculos «con ejemplos calculados manualmente» se ha convertido en 36 pruebas automáticas con datos reales guardados.

## 2. Las tres decisiones importantes y lo que descartamos

### Decisión 1 · Buscar por ticker en lugar de subir las cuentas

**Qué decidimos.** El usuario escribe un ticker y la web descarga de Yahoo Finance el balance, la cuenta de resultados, los flujos de caja y la capitalización de cada cierre anual.

**Por qué.**
- **Menos fricción.** Con el prototipo de Streamlit, el usuario tenía que buscar las cuentas, descargarlas, ponerlas en el formato esperado y subirlas. Con un ticker, el análisis está listo en unos segundos.
- **Menos riesgo de lectura.** Las cifras llegan estructuradas, cada una con su fecha y su moneda.
- **Comparables posibles.** Al poder descargar cualquier empresa cotizada, la comparación sectorial deja de depender de que el usuario suba también las cuentas de sus competidores (decisión 2).

**Qué costó y cómo lo controlamos.**
- **Yahoo no es una fuente primaria.** Por eso cada partida se contrasta con el 10-K presentado en la SEC (API de EDGAR), con una tolerancia del 0,5 %.
- **El EBIT de Yahoo no es el resultado operativo.** El contraste lo destapó en Alphabet (2025): 159.562 M$ de EBIT en Yahoo frente a 129.039 M$ de resultado operativo en el 10-K. Yahoo parte del resultado antes de impuestos e incluye ingresos financieros.
  - Mantuvimos el EBIT de Yahoo, porque es la única definición disponible para todas las empresas, también las europeas.
  - Renombramos el ratio a «margen EBIT» en lugar de «margen operativo».
  - La pestaña de verificación muestra la diferencia.
- **A veces faltan datos.** La regla es no inventar: el ratio queda «Pendiente» y se explica por qué.
  - Hay un hueco que existe en el 10-K: el usuario puede completarlo, siempre de forma visible y reversible.
  - Hay un hueco que se puede reconstruir con partidas del mismo cierre: se reconstruye y se marca como «derivado» con su fórmula. Por ejemplo, el EBITDA como EBIT más amortizaciones.

**Qué descartamos.**
- **Leer PDF con IA.** No llegamos a construirlo. Una cifra mal leída cambia todos los ratios y es difícil de detectar. Además, la extracción automática necesitaba un modelo por API, con coste por consulta.
- **Seguir con la subida de CSV o Excel del prototipo.** Funcionaba, pero obligaba al usuario a preparar los datos y no permitía comparar con el sector sin que subiera también las cuentas de los comparables.
- **Tomar Yahoo como verdad.** Era más rápido, pero no habríamos detectado diferencias de definición como la del EBIT.

### Decisión 2 · Comparar con el sector en lugar de puntuar

**Qué decidimos.** Cada ratio se compara con la mediana y el rango intercuartílico (P25–P75) de un grupo de comparables.
- Hay 30 grupos definidos por el equipo (Ibex 35, Euro Stoxx 50 y grandes cotizadas de EE. UU.), con 247 tickers comprobados uno a uno en Yahoo el 08/11.
- El usuario elige el grupo en un desplegable, con uno recomendado por defecto.
- Se usa el ejercicio de cada comparable más cercano al de la empresa, con un máximo de 12 meses de diferencia.
- Con menos de 3 valores no se publica mediana.

**Por qué.**
- **Un ratio solo se entiende frente a su sector.** Una nota general habría mezclado sectores incomparables. Una nota adaptada a cada sector nos habría obligado a inventar umbrales para decenas de sectores sin base que los justificara.
- **La mediana y no la media.** La media se dispara con valores extremos, como un ROE del 140 % o una rotación de inventarios de 195×.
- **Comparables con datos.** Los comparables con el ratio pendiente (por ejemplo, el ROE con patrimonio negativo) se excluyen de la estadística, y la web dice cuáles son.

**Qué descartamos.**
- **La puntuación por área de la propuesta**, por lo explicado arriba.
- **Las «recomendaciones» de Yahoo como comparables.** Proponen las empresas que siguen los mismos inversores, no las del mismo sector. Para Inditex sugería Iberdrola, Repsol y ACS.
- **Que el usuario escriba su propia lista de comparables.** No podríamos justificar ningún grupo. El servidor conserva la opción, pero la interfaz no la ofrece.

**Ejemplo.** En el grupo de restauración de McDonald's, SBUX, YUM y DPZ también tienen patrimonio negativo. La mediana del ROE sale solo de CMG, DRI y QSR, y la web indica qué empresas se excluyen y por qué.

### Decisión 3 · Añadir una valoración DCF con todos los supuestos a la vista

**Qué decidimos.** La pestaña «Valoración DCF» descuenta al WACC los flujos de caja libres para la empresa (FCFF):
- **FCFF** = EBIT × (1 − t) + amortizaciones − capex − inversión en circulante.
- **Proyección y valor terminal:** 5 años de proyección y un valor terminal por crecimiento a perpetuidad (Gordon) o por múltiplo EV/EBITDA.
- **Supuestos editables:** todos parten de la media de los tres últimos ejercicios o de una fuente citada. El usuario puede cambiar cualquiera y queda marcado como «supuesto del usuario».
- **Tabla de sensibilidad:** muestra cómo cambia el valor si cambian el WACC y el crecimiento.

**La beta, el parámetro más delicado.**
- Se parte de la beta desapalancada de la industria en las tablas de Aswath Damodaran (NYU Stern, actualización del 05/01/2026).
- Se reapalanca con la deuda/patrimonio de la empresa a valor de mercado: βL = βU × [1 + (1 − t) × D/E].
- La industria de cada empresa sale de la propia clasificación de Damodaran, que cubre 246 de nuestros 247 tickers.
- Junto a la fórmula, un aviso explica que es una estimación: supone que la empresa tiene el riesgo medio de su sector y que mantendrá su endeudamiento, y no es una regresión de su cotización.
- El resto del WACC también tiene fuente:
  - prima de riesgo de mercado y prima de riesgo país, de Damodaran;
  - tipo libre de riesgo: el Treasury a 10 años (USD) o la curva AAA del Banco Central Europeo (EUR).

**Por qué.**
- **Valoración, no solo diagnóstico.** Los ratios dicen cómo está una empresa; el DCF estima cuánto vale según la caja que genera.
- **FCFF y no FCFE.** El FCFF es el modelo de referencia del temario CFA y no depende de cómo se financie la empresa cada año.
- **Supuestos editables.** El valor de un DCF depende casi por completo de sus supuestos. Mostrarlos, con su origen, es coherente con el resto de la web.

**Qué descartamos.**
- **La beta que publica Yahoo.** Exige un token para descargarla, depende de la ventana de regresión y es muy ruidosa por empresa. La media de una industria con decenas de empresas es más estable y se puede explicar.
- **Reapalancar con el tipo impositivo efectivo de la empresa.** Comprobamos en las 288 filas de sus tablas (96 industrias en cada una de las tres regiones) que Damodaran desapalanca con el tipo marginal (25 % en EE. UU.). Si reapalancáramos con otro tipo, ida y vuelta no serían coherentes.
- **Valorar bancos y aseguradoras por FCFF.** En un banco, la deuda y los depósitos son su materia prima, así que el WACC y el flujo libre no tienen sentido. La web no calcula el DCF, explica por qué e indica el modelo que se usaría en su lugar (exceso de rentabilidad sobre el patrimonio).
- **Supuestos fijos o una única cifra de valor.** Habría escondido que el resultado es muy sensible a los supuestos.

**Ejemplo (McDonald's, 25/11/2026).**
- **Beta:** la beta desapalancada de restauración (0,767), reapalancada con una deuda/patrimonio de mercado de 0,274, da una beta de 0,925.
- **Coste de capital:** un coste del capital propio del 8,96 % y un WACC del 7,54 %.
- **Resultado:** 192 $ por acción con Gordon al 2 % y 305 $ con el múltiplo medio de su industria, frente a una cotización de 281 $.
- **Lectura:** el valor terminal pesa el 77 % del valor de empresa. La web enseña esa sensibilidad en lugar de esconderla detrás de una única cifra.

## 3. ¿Dónde falló la máquina?

> **Herramientas.** Las primeras versiones de la web se hicieron con ChatGPT/Codex. Las mejoras de noviembre (flujo de caja, casos límite, verificación con la SEC, comparables y DCF) se hicieron con Claude. Los tres casos son de esta última fase.

### Caso 1 · Agrupó a Inditex por índice bursátil y no por sector

- **Qué nos dijo.** En el primer reparto de comparables (14 grupos), la IA metió a Inditex en un grupo del Ibex junto a Repsol, Aena y Telefónica, y lo presentó como su grupo sectorial. La mediana «del sector» de Inditex se calculaba frente a una petrolera, un gestor aeroportuario y una teleco.
- **Cómo lo detectamos.** Probando distintos tickers para comprobar que todo funcionaba. Al revisar Inditex vimos que su rotación de inventarios y su margen se comparaban con empresas que casi no tienen inventario o cuyos márgenes responden a una estructura de costes distinta. Las etiquetas «por encima» o «por debajo del rango» no tenían ningún sentido.
- **Fuente primaria.** Las cuentas anuales de Inditex depositadas en la CNMV, que describen su actividad como diseño, fabricación y distribución minorista de moda.
- **Corrección.** Se creó el grupo «Moda y distribución textil» con H&M, TJX, Ross, Gap, Lululemon, Nike y Adidas. Como los ratios no tienen unidades, se pueden comparar aunque H&M presente sus cuentas en coronas suecas.

### Caso 2 · Dio por inexistentes datos que Yahoo sí tiene

- **Qué nos dijo.** El código que escribió la IA interpretaba «la serie me llega vacía» como «el dato no existe» y dejaba el ratio «Pendiente». Lo dio por correcto porque las pruebas pasaban. Así, en la web publicada:
  - Iberdrola aparecía sin EBIT.
  - ASML aparecía sin flujo de caja operativo.
  - Varios ratios quedaban pendientes sin motivo real.
- **Cómo lo detectamos.** Comparando empresa a empresa la web publicada con Yahoo Finance abierto en el navegador. Las partidas que la web daba por inexistentes sí aparecían en Yahoo.
  - **La causa:** Yahoo responde distinto según desde dónde se le consulte. Al servidor de Vercel (en Washington) le llegaban vacías series que desde el navegador sí aparecen, con la misma petición.
  - **Comprobación en el entorno real:** desde entonces, todo se comprueba en la web publicada, en el mismo entorno que usa cualquier usuario.
- **Fuente primaria.** Los estados financieros de cada empresa tal como los publica Yahoo Finance (balance, resultados y flujos de caja), consultados directamente en su web. Sirvieron para confirmar que los datos existían y para comprobar las fórmulas de reconstrucción.
- **Corrección.**
  - Cuando falta una partida, la web la calcula con otras del mismo ejercicio y la misma moneda:
    - EBIT = resultado antes de impuestos + gasto por intereses;
    - flujo operativo = flujo de caja libre + capex;
    - EBITDA = EBIT + amortizaciones.
  - La partida reconstruida se marca como «derivada» en «Datos brutos», con su fórmula.
  - Nunca sustituye una cifra publicada ni mezcla monedas.
  - Comprobamos las fórmulas con datos reales: el EBIT reconstruido coincide exactamente con el de Yahoo en Iberdrola, Inditex, McDonald's, Repsol y Telefónica, y el EBITDA de Iberdrola (10.270 + 6.493 = 16.763 M€) coincide con el publicado.
  - Se añadió una prueba con estas cifras.

### Caso 3 · Propuso que el usuario introdujera la beta a mano

- **Qué nos dijo.** Al diseñar el DCF, la IA propuso que varios parámetros del WACC los introdujera el usuario: la beta, el tipo libre de riesgo, la prima de riesgo de mercado y el coste de la deuda. En el caso de la beta lo justificó así: «Yahoo exige un token para darla y cambia según la ventana de cálculo. Es más honesto que el usuario la introduzca e indique su fuente.»
- **Cómo lo detectamos.** Al revisar el plan vimos que no iba a funcionar.
  - El usuario de la web no tiene una beta a mano, así que acabaría escribiendo un número sin justificar.
  - Dos usuarios obtendrían valores distintos para la misma empresa.
  - La web perdería lo que la diferencia: que cada cifra tenga una fuente. El DCF habría quedado como una calculadora vacía.
- **Fuente primaria.** Las tablas de betas por industria de Aswath Damodaran (NYU Stern, actualización del 05/01/2026; archivos `betas.xls`, `betaEurope.xls` y `betaGlobal.xls`). Recogen, para cada industria, la beta media, la deuda/patrimonio de mercado, el tipo impositivo y la beta desapalancada.
- **Corrección.**
  - La web descarga la beta desapalancada de la industria de la empresa, según la clasificación de Damodaran.
  - La vuelve a apalancar con la deuda/patrimonio de la empresa a valor de mercado: βL = βU × [1 + (1 − t) × D/E].
  - El usuario puede cambiarla, pero parte de una cifra con fuente.
  - La prima de riesgo de mercado y la de riesgo país también salen de Damodaran. El tipo libre de riesgo sale del Treasury a 10 años o de la curva del Banco Central Europeo, y el coste de la deuda, del histórico de la empresa.
- **Comprobación de la fórmula.** Al verificarla contra las tablas vimos que Damodaran desapalanca con el tipo **marginal** (25 % en EE. UU.), no con el efectivo, que es el que proponía la IA. Reapalancando con ese mismo tipo se recupera la beta apalancada publicada en las 288 filas de sus tablas (96 industrias en cada una de las tres regiones). Esa comprobación quedó como una prueba automática del proyecto.

## 4. ¿Qué haríamos distinto?

- **Pedirle a la IA varios planes antes de empezar y elegir el que mejor encajara.**
  - Empezamos construyendo la primera idea que teníamos: un prototipo en Streamlit para subir CSV o Excel. Más tarde vimos que buscar por ticker era mucho mejor para el usuario.
  - Si al principio hubiéramos pedido a la IA dos o tres planes distintos (subir documentos, buscar por ticker, conectar con una base de datos), con sus ventajas e inconvenientes, habríamos comparado las opciones antes de programar. Probablemente nos habríamos ahorrado el prototipo.
- **No aceptar cambios sin pruebas.**
  - El 22/10 el Altman pasó a calcularse automáticamente sin ejecutar ninguna prueba, también para bancos, donde el modelo clásico no está pensado. Hoy la web avisa en banca, seguros e inmobiliario, pero esa decisión debería haberse tomado y probado en el mismo cambio.
  - Desde noviembre, cada cambio llega con su prueba. Hay 36 pruebas con datos reales guardados; por ejemplo, el FCF calculado de McDonald's coincide con el publicado (7.186 M$).
- **Pedirle a la IA que justifique cada parámetro.**
  - Los tres errores del apartado 3 son datos y decisiones de diseño que la IA presentó como obvios: con qué empresas comparar a Inditex, qué significa una serie vacía y quién pone la beta.
  - Ninguno era un fallo de cálculo. Ahora le pedimos la fuente y una alternativa para cada parámetro que propone, y comprobamos cada dato antes de usarlo.
- **Pensar en quien usa la web, no solo en el cálculo.**
  - Una fórmula correcta no basta si el usuario no puede usarla. Pedirle una beta que no tiene (caso 3) habría dejado el DCF vacío.
  - Una auditoría de legibilidad en un navegador real encontró 68 tipos de texto por debajo de 12 px y 89 con poco contraste. En el móvil, además, la tabla de ratios escondía la mediana del sector.
  - Lo corregimos, pero habría sido mejor revisar la web como usuario desde el principio, en ordenador y en móvil.

**Alcance.** La verificación automática con la fuente primaria cubre las empresas que presentan un 10-K ante la SEC. Para emisores españoles como Inditex o Santander, la fuente primaria son sus cuentas en la CNMV. La web lo indica, pero ese contraste queda fuera del proyecto.

---

*Uso de IA:* ChatGPT/Codex (prototipo y primeras versiones de la web) y Claude (flujo de caja, casos límite, verificación con la SEC, comparables, DCF, auditoría y redacción de este informe). La IA escribió código y documentación. Ningún cálculo de la web depende de un modelo generativo: todas las fórmulas son código determinista con pruebas. Las decisiones del apartado 2 son del equipo.
