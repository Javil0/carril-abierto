# Bitácora · Carril Abierto

**Equipo:** Javier López-Montenegro, Alejandro Torres y Bruno Ribeiro
**Asignatura:** Análisis de servicio financiero · El carril abierto · Nivel 2 (Construir)
**Proyecto:** github.com/Javil0/carril-abierto · Web: https://carril-abierto.vercel.app
**Entrega:** 26/11/2026

---

## 1. Qué queríamos hacer y qué hicimos

**La propuesta (24/09).** Una web en la que el usuario subiera el balance y la cuenta de resultados en PDF o Excel. La IA extraería las partidas, calcularía ratios, pondría una puntuación por área (liquidez, solvencia, rentabilidad y eficiencia) y explicaría el resultado en lenguaje claro.

**Lo que entregamos.** Una web en la que se introduce un ticker y se obtienen los estados financieros anuales de la empresa desde Yahoo Finance. Con ellos calcula 13 ratios en cinco dimensiones (liquidez, deuda, actividad, rentabilidad y flujo de caja), el DuPont y el Altman Z-score. Cada partida se contrasta con el 10-K presentado en la SEC y cada ratio se compara con la mediana de un grupo de comparables. Cada cifra muestra su fórmula y su origen. Si falta un dato, el ratio queda «Pendiente».

**Qué cambió y por qué.** Cambiamos de idea dos veces:

1. **20/10 · De subir documentos a buscar por ticker.** El primer prototipo (Streamlit, en `prototipo-streamlit/`) leía CSV y Excel. Extraer cifras de PDF con formatos distintos era la parte que más miedo nos daba: una cifra mal leída cambia todos los ratios y es difícil de ver. Al buscar por ticker, las cifras llegan ya estructuradas, y el riesgo pasa de «leer mal» a «la fuente define la partida de otra manera». Ese riesgo sí se puede controlar contrastando con la fuente primaria (decisión 2).
2. **De la puntuación y la explicación con IA a reglas trazables.** No hay puntuación por área ni texto generado por un modelo. Un ratio no es bueno ni malo sin contexto sectorial, y una nota de 0 a 10 habría escondido esa falta de contexto. Lo sustituimos por la comparación con el sector: «por encima» o «por debajo» del rango P25–P75, como descripción y no como nota.

**Punto de control (22/10).** El profesor señaló dos carencias: faltaban métricas de flujo de caja y había que tratar los fondos propios negativos y la deuda neta negativa. El 06/11 añadimos el FCF yield, la cobertura de deuda por flujo operativo y la deuda neta/EBITDA, y los casos límite que se explican en la decisión 2.

**Ancla financiera.** El proyecto trata el análisis de estados financieros. La selección de ratios sigue el temario del CFA, aunque no es una clasificación oficial. Trabajarlo nos obligó a entender tres cosas que antes dábamos por hechas:
- Un proveedor de datos no es una fuente primaria. La fuente primaria es lo que la empresa presenta ante su supervisor (el 10-K en la SEC o las cuentas en la CNMV).
- La misma etiqueta («EBIT») puede referirse a magnitudes distintas.
- Algunos ratios dejan de tener sentido en ciertos casos: el ROE con patrimonio negativo, la deuda neta/EBITDA con caja neta o el Altman en bancos.

## 2. Las decisiones importantes y lo que descartamos

### Decisión 1 · Ningún dato inventado: «Pendiente» antes que un número dudoso
Si falta una partida, si el denominador es cero o negativo o si los periodos no coinciden, el ratio no se calcula y se explica por qué. Los promedios exigen un cierre anterior en la misma moneda.
- **Descartado:** rellenar los huecos con cero, con la media del sector o con estimaciones de la IA. La herramienta tendría siempre una cifra, pero a costa de presentar como dato lo que es una suposición.
- **Ejemplo:** Apple no tiene gasto por intereses en Yahoo y su cobertura de intereses aparece como «Pendiente». Al consultar el 10-K comprobamos que Apple tampoco lo publica con la etiqueta `InterestExpense`. No era un fallo de la fuente: el dato no existe en ese formato.

### Decisión 2 · Contrastar con la fuente primaria y tratar los casos límite
- **Verificación con la SEC.** Cada partida de Yahoo se compara con el 10-K del mismo cierre (API companyfacts de EDGAR, us-gaap). Tolerancia del 0,5 % y hasta 10 días de diferencia de fecha, porque Yahoo lleva el cierre de Apple del 26/09 al 30/09. Solo se usan datos anuales de 10-K y, si hay una reexpresión, se toma la cifra más reciente. «Completar huecos» solo rellena lo que falta en Yahoo, nunca sustituye una cifra, y se puede deshacer.
- **El EBIT de Yahoo no es el resultado operativo.** El contraste lo destapó en Alphabet (2025): 159.562 M de EBIT en Yahoo frente a 129.039 M de resultado operativo en el 10-K (`OperatingIncomeLoss`), un 23,7 % más. La causa es que Yahoo calcula el EBIT a partir del resultado antes de impuestos e incluye ingresos financieros y otros resultados. Con la cifra del 10-K, el margen pasaría del 39,6 % al 32,0 %.
  - **Decisión:** mantener el EBIT de Yahoo y renombrar el ratio a «Margen EBIT» (EBIT / ingresos) en vez de «margen operativo». Es la única definición disponible para todas las empresas, también las no estadounidenses, y así la comparación sectorial no mezcla definiciones. Cuando hay 10-K, la pestaña de verificación muestra la diferencia con el resultado operativo.
  - **Descartado:** usar el resultado operativo del 10-K cuando existe. La cifra sería más exacta para cada empresa estadounidense, pero la mediana del sector mezclaría dos definiciones distintas.
- **Patrimonio negativo** (McDonald's: −1.790 M$). D/E, ROE y DuPont quedan pendientes. El ROE también queda pendiente si alguno de los dos cierres del promedio es negativo, porque la media podría salir positiva y ocultarlo.
- **Deuda neta negativa** (Alphabet: caja neta de 67.552 M$). El ratio sale negativo y se etiqueta «caja neta»: indica holgura, no un apalancamiento menor.
- **Descartado:** tomar Yahoo como verdad, que es más rápido pero no permite detectar diferencias de definición como la del EBIT. También descartamos descargar el 10-K completo de cada empresa: es más lento y la API estructurada da lo mismo con menos riesgo de lectura.

### Decisión 3 · Comparables definidos por el equipo, con mediana y rango intercuartílico
Hay 30 grupos (Ibex 35, Euro Stoxx 50 y grandes cotizadas de EE. UU.) con 247 tickers comprobados uno a uno en Yahoo el 08/11. El usuario elige el grupo en un desplegable. Para cada ratio se calcula la mediana y el rango P25–P75 con el ejercicio de cada comparable más cercano al de la empresa (máximo 12 meses). Con menos de 3 valores no se publica mediana, y los comparables con el ratio pendiente quedan fuera de la estadística.
- **Por qué la mediana:** la media se dispara con valores extremos (un ROE del 140 % o una rotación de inventarios de 195×).
- **Descartado (1):** las «recomendaciones» de Yahoo. Proponen las empresas que siguen los mismos inversores, no las del mismo sector: para Inditex, Iberdrola, Repsol y ACS.
- **Descartado (2):** dejar que el usuario escriba su propia lista. Así no podríamos justificar ningún grupo. El servidor conserva la opción, pero la interfaz ya no la ofrece.
- **Ejemplo:** en el grupo de restauración de McDonald's, SBUX, YUM y DPZ también tienen patrimonio negativo. La mediana del ROE (47,4 %) sale solo de CMG, DRI y QSR, y la web indica qué empresas se excluyen.

### Decisión 4 · DCF por FCFF con una beta construida desde Damodaran, y todo editable
La pestaña «Valoración DCF» descuenta los flujos de caja libres para la empresa (FCFF) al WACC, con valor terminal por Gordon o por múltiplo EV/EBITDA. Cada supuesto parte del histórico (media de tres ejercicios) o de una fuente citada, y el usuario puede cambiarlo. Lo cambiado queda marcado como «supuesto del usuario».
- **La beta:** la beta desapalancada de la industria de Damodaran (05/01/2026) se reapalanca con la D/E de la empresa a valor de mercado: βL = βU × [1 + (1 − t) × D/E]. Junto a la fórmula, un aviso explica que la beta supone el riesgo medio del sector y una deuda estable, y que no es una regresión de la cotización.
- **Hallazgo:** Damodaran desapalanca con el tipo marginal (25 % en EE. UU.), no con el efectivo. Lo comprobamos en sus 288 filas y reapalancamos con ese mismo tipo para que ida y vuelta sean coherentes.
- **Descartado (1):** la beta de Yahoo. Exige un token, depende de la ventana de regresión y es muy ruidosa por empresa. La media de una industria con decenas de empresas es más estable y se puede explicar.
- **Descartado (2):** valorar bancos y aseguradoras por FCFF. Su deuda es materia prima, no financiación, así que la web lo bloquea y explica por qué.
- **Ejemplo:** McDonald's vale 192 $ por acción con Gordon al 2 % y 305 $ con el múltiplo de su industria, frente a 281 $ de cotización. El valor terminal pesa el 77 % del EV. La web enseña esa sensibilidad en lugar de esconderla en una cifra.

## 3. Dónde falló la máquina: tres casos

> *Herramientas:* las primeras versiones se hicieron con ChatGPT/Codex; las mejoras de noviembre (flujo de caja, casos límite, verificación con la SEC y comparables), con Claude. Los tres casos son de esta última fase.

### Caso 1 · Tickers que no correspondían a la empresa o sin datos
- **Qué nos dijo:** al definir los grupos de comparables, la IA propuso «FI» para Fiserv y «ROG.SW» para Roche, e incluyó a Logista en su grupo. Los presentó como tickers válidos de Yahoo.
- **Cómo lo detectamos:** antes de publicar comprobamos uno a uno los 248 tickers en Yahoo Finance, que es la fuente de la que la web descarga los datos. Fiserv cotiza como «FISV» y Roche, como «RO.SW». En Logista, Yahoo no tenía el último ejercicio.
- **Por qué importa:** un ticker erróneo hace que un comparable desaparezca sin avisar o, peor, que en la mediana entren datos de otra cotización.
- **Corrección:** cambiamos Fiserv a «FISV» y Roche a «RO.SW» y excluimos Logista. Quedan 247 tickers.

### Caso 2 · Agrupó a Inditex por índice bursátil y no por sector
- **Qué nos dijo:** el primer reparto de comparables generado con la IA (14 grupos) metía a Inditex en un grupo del Ibex junto a Repsol, Aena y Telefónica. La mediana sectorial de Inditex se calculaba, por tanto, frente a una petrolera, un gestor aeroportuario y una teleco.
- **Cómo lo detectamos:** al poner Inditex como ejemplo en la portada, la rotación de inventarios y el margen se comparaban con empresas que casi no tienen inventario o cuyos márgenes responden a una estructura de costes distinta.
- **Fuente primaria:** las cuentas anuales de Inditex en la CNMV, que describen su actividad como diseño y distribución minorista de moda.
- **Corrección:** se creó el grupo «Moda y distribución textil» (H&M, TJX, Ross, Gap, Lululemon, Nike y Adidas). Los ratios no tienen unidades, así que se pueden comparar aunque H&M informe en coronas suecas.

### Caso 3 · Una ventana de 200 días que dejaba a Apple casi sin comparables
- **Qué nos dijo:** la IA fijó un máximo de 200 días entre el cierre de la empresa y el de cada comparable y lo presentó como suficiente para que los ejercicios fueran comparables.
- **Cómo lo detectamos:** en la web publicada en Vercel, Apple solo reunía 2 comparables y no tenía mediana sectorial.
- **Fuente primaria:** las portadas de los 10-K. El ejercicio de Apple termina el último sábado de septiembre, y el de Alphabet, Meta y Amazon, el 31 de diciembre. Entre el último cierre de Apple (septiembre de 2026) y el último cierre de sus comparables (diciembre de 2025) hay 273 días.
- **Corrección:** la ventana pasa a 12 meses y la web muestra la fecha del ejercicio de cada comparable, para que el usuario vea el desfase.

## 4. Qué haríamos distinto

- **Contrastar con la fuente primaria desde el primer día.** La verificación con la SEC llegó el 06/11, y hasta entonces la web llamó «margen operativo» a un EBIT que no lo es. Si empezáramos de nuevo, antes de escribir ninguna fórmula compararíamos tres empresas con su 10-K.
- **Escribir el criterio de éxito antes de empezar.** La propuesta decía que los cálculos «se comprobarán con ejemplos calculados manualmente», pero no fijaba qué cuenta como acierto. Hoy hay 36 pruebas con datos reales guardados en `tests/fixtures` (por ejemplo, el FCF calculado de McDonald's coincide con el publicado: 7.186 M$). Habría sido mejor definirlas como objetivo desde el principio.
- **No aceptar cambios sin pruebas.** El 22/10 el Altman pasó a calcularse automáticamente sin ejecutar ninguna prueba, también para bancos, donde el modelo clásico no está pensado. Hoy la web muestra un aviso de lectura en banca, seguros e inmobiliario, pero esa decisión debería haberse tomado y probado en el mismo cambio.
- **Pedirle a la IA que justifique cada parámetro.** Los tres errores del apartado 3 son datos y decisiones de diseño que la IA presentó como obvios: qué ticker usar, cómo agrupar y qué ventana fijar. Ninguno era un fallo de código. Desde ahora le pedimos la fuente y una alternativa para cada parámetro que propone, y comprobamos cada dato antes de usarlo.

**Alcance.** La verificación automática con la fuente primaria cubre los emisores que presentan 10-K ante la SEC. Para emisores españoles como Inditex o Santander, la fuente primaria son sus cuentas depositadas en la CNMV. La web lo indica, pero ese contraste queda fuera del alcance del proyecto.

---

*Uso de IA:* ChatGPT/Codex (prototipo y primeras versiones de la web) y Claude (flujo de caja, casos límite, verificación con la SEC, comparables y esta bitácora). La IA escribió código y documentación. Ningún cálculo depende de un modelo generativo: todas las fórmulas son código determinista con pruebas. Las decisiones del apartado 2 son del equipo.

*Anexo:* el registro cronológico detallado de cambios está en `BITACORA.md`.
