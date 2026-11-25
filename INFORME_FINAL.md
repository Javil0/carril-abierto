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
   - Además, las cifras llegan estructuradas. El riesgo deja de ser «leer mal un número» y pasa a ser «que la fuente defina la partida de otra manera», y ese riesgo sí lo podemos controlar contrastando con la fuente primaria (decisión 2).
2. **Sin IA dentro de la web.**
   - Al principio queríamos llamar a un modelo de IA desde la web para interpretar los resultados. Al mirarlo vimos que el uso por API no está incluido en las suscripciones mensuales de Claude ni de ChatGPT: cada consulta tendría un coste.
   - Decidimos hacerlo todo con código: cálculos, avisos y explicaciones son reglas deterministas y probadas.
   - La IA se ha usado para desarrollar la web, no dentro de ella. Eso tiene una ventaja: el mismo dato da siempre el mismo resultado, y cada explicación se puede rastrear hasta su regla.
3. **Punto de control (22/10).**
   - El profesor señaló dos carencias: faltaban métricas de flujo de caja, y había que tratar el patrimonio neto negativo y la deuda neta negativa. Las resolvimos el 06/11.
   - Se añadieron el FCF yield, la cobertura de deuda por flujo operativo y la deuda neta/EBITDA.
   - Con patrimonio negativo (McDonald's: −1.790 M$), la deuda/patrimonio, el ROE y el DuPont quedan «Pendiente» en lugar de mostrar cifras con el signo invertido.
   - Con deuda neta negativa (Alphabet), el ratio se etiqueta como «caja neta».
4. **Valoración DCF (25/11).**
   - Si la web sirve para analizar empresas, tenía sentido que también estimara cuánto valen según los flujos de caja que generan, y no solo cómo están.
   - Se añadió un DCF por flujo de caja libre para la empresa (FCFF), con todos los supuestos editables y la beta construida a partir de las tablas de Damodaran (decisión 4).

**Qué se mantiene de la propuesta.**
- **Datos que faltan:** la propuesta decía que, si un dato faltaba o no se podía leer con seguridad, la herramienta lo marcaría para que el usuario lo revisara en lugar de asumirlo. Es el «Pendiente» de la web: nunca se rellena un hueco con cero ni con una estimación.
- **Huecos que sí existen en la fuente primaria:** se pueden completar con el 10-K, pero solo si el usuario lo pide. Siempre queda marcado y se puede deshacer.
- **Fórmulas explícitas:** se mantienen, igual que el compromiso de que el usuario vea «qué cifras explican cada conclusión». Cada ratio enseña su fórmula, el numerador, el denominador y las partidas de origen.
- **Comprobación manual:** la promesa de comprobar los cálculos «con ejemplos calculados manualmente» se ha convertido en 36 pruebas automáticas con datos reales guardados.

## 2. Las tres decisiones importantes y lo que descartamos

*(pendiente)*

## 3. ¿Dónde falló la máquina?

*(pendiente)*

## 4. ¿Qué haríamos distinto?

*(pendiente)*
