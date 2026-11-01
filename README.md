# Analizador Espectral FFT & Laboratorio de Síntesis de Ondas

Herramienta interactiva de instrumentación virtual orientada al procesamiento digital de señales acústicas, cálculo de la Transformada Rápida de Fourier (FFT), descomposición armónica en series de Fourier y psicoacústica del timbre.

Desarrollada para complementar prácticas de laboratorio de física ondulatoria, telecomunicaciones y procesamiento digital de señales (DSP).

---

## 🚀 Demostración en Vivo
Puedes acceder a la versión desplegada en GitHub Pages en el siguiente enlace:
> **🔗 URL:** `https://<TU-USUARIO>.github.io/<TU-REPOSITORIO>/analizador_espectral_fft.html`  
*(Reemplaza `<TU-USUARIO>` y `<TU-REPOSITORIO>` por los datos correspondientes de tu cuenta)*.

---

## 📌 Características Principales

### 1. Analizador Espectral en Tiempo Real (`analizador_espectral_fft.html`)
* **Osciloscopio Digital:** Graficación en el dominio del tiempo $f(t)$ con disparo automático (*trigger*) para estabilización de forma de onda.
* **Espectro de Magnitud FFT:** Descomposición continua de frecuencias con visualización de guías armónicas ($f_0, 2f_0, 3f_0, \dots$) y rangos adaptativos por número de términos.
* **Sistema de Cursores Dinámicos:** Hasta 5 marcadores independientes para medición puntual de picos armónicos, identificación de notas musicales y cálculo diferencial ($\Delta f$ y $\Delta t$).
* **Algoritmo de Detección de Crestas:** Salto automatizado a armónicos consecutivos hacia la derecha (*Snap Peak*).
* **Espectrograma / Cascada Térmica (Waterfall):** Mapeo de densidad espectral a lo largo del tiempo para visualización de armónicos persistentes y transitorios.
* **Doble Modo de Operación:**
  * **Emisor:** Generación de señales analíticas puras (Senoidal, Cuadrada, Diente de Sierra y Triangular) con control de tono fundamental ($f_0$) y presets estándar (La 440 Hz, 880 Hz, etc.).
  * **Receptor:** Captura acústica en vivo mediante transductor/micrófono vía `getUserMedia`, aislado de la salida para evitar retroalimentación acústica (*feedback*).

### 2. Laboratorio de Diseño y Síntesis de Ondas (`dibujar_onda.html`)
* **Trazado Manual Interactivo:** Dibujo libre de un periodo fundamental $T$ mediante puntero o interfaz táctil.
* **Evaluador de Expresiones Matemáticas $f(t)$:** Entrada de funciones arbitrarias (ej. `sin(2*pi*t) + 0.33*sin(6*pi*t)`) con presets de modulación FM, batimiento, rectificación y amortiguamiento.
* **Cálculo de Coeficientes de Fourier:** Extracción analítica discreta de las amplitudes $c_n = \sqrt{a_n^2 + b_n^2}$ para los primeros 32 armónicos.
* **Resíntesis Aditiva de Audio:** Reproducción sonora en tiempo real del timbre resultante a partir de la tabla periódica generada (`createPeriodicWave`).

---

## 📐 Fundamento Físico y Matemático

El instrumento permite contrastar experimentalmente las soluciones de las Series de Fourier continuas:

$$f(t) = a_0 + \sum_{n=1}^{\infty} \left[ a_n \cos(n\omega_0 t) + b_n \sin(n\omega_0 t) \right]$$

frente a la aproximación discreta calculada mediante el algoritmo FFT con un tamaño de bloque $N$:

$$X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-j \frac{2\pi}{N} k n}$$

### Comparativa de Comportamiento Armónico
| Forma de onda | Contenido armónico | Tasa de caída espectral | Carácter tímbrico audible |
| :--- | :--- | :--- | :--- |
| **Cuadrada** | Exclusivamente impares ($1f_0, 3f_0, 5f_0, \dots$) | $\mathcal{O}(1/n)$ ($-6\text{ dB/oct}$) | Tono hueco, nasal (madera / clarinete) |
| **Diente de sierra** | Todos los armónicos ($1f_0, 2f_0, 3f_0, 4f_0, \dots$) | $\mathcal{O}(1/n)$ ($-6\text{ dB/oct}$) | Tono brillante, rico, agresivo (bronce / cuerdas) |
| **Triangular** | Exclusivamente impares ($1f_0, 3f_0, 5f_0, \dots$) | $\mathcal{O}(1/n^2)$ ($-12\text{ dB/oct}$) | Tono suave, redondo, próximo a senoide pura |

---

## 🛠️ Tecnologías Empleadas

* **Web Audio API:** Procesamiento e inferencia digital de señales mediante `AudioContext`, `AnalyserNode` ($N = 4096$) y `OscillatorNode`.
* **HTML5 Canvas (2D API):** Renderizado optimizado a 60 FPS del osciloscopio, espectro de líneas, cursores y cascada térmica.
* **Tailwind CSS:** Diseño responsivo y conmutable entre tema claro y oscuro.
* **Vanilla JavaScript:** Lógica matemática de evaluación, cálculo de coeficientes de Fourier y enlace entre interfaces sin frameworks externos.

---

## 💻 Ejecución Local

Para garantizar el acceso seguro al micrófono (`getUserMedia`), los navegadores modernos exigen ejecutarse en un entorno seguro (`https://` o `http://localhost`).

### Opción 1: En Windows
Ejecutar el script por lotes incluido en el proyecto:
```cmd
iniciar_analizador.bat
```
*(Inicia un servidor HTTP local en el puerto `8080` y abre automáticamente el navegador)*.

### Opción 2: Mediante Python (Cualquier sistema operativo)
```bash
# Iniciar servidor local en el directorio de la carpeta
python -m http.server 8080
```
Abrir en el navegador:
```text
http://localhost:8080/analizador_espectral_fft.html
```

---

## 📂 Estructura del Repositorio

```text
├── analizador_espectral_fft.html  # Interfaz principal: Osciloscopio, FFT, Waterfall y Cursores
├── transformada.js                # Lógica del analizador FFT y control de audio Web Audio API
├── dibujar_onda.html              # Interfaz de diseño y síntesis manual / matemática f(t)
├── dibujar_onda.js                # Cálculo de series de Fourier y resíntesis de timbre
├── style.css                      # Reglas de estilos, paleta de colores y componentes interactivos
├── iniciar_analizador.bat         # Script para ejecución rápida con servidor local en Windows
└── README.md                      # Documentación técnica del proyecto
```

---

## 👥 Créditos y Referencias

* **Desarrollo:** Desarrollado como instrumento de laboratorio para la caracterización de ondas mecánicas y acústicas.
* **Asistencia Técnica:** Modelado algorítmico, formulación matemática y estructuración de código desarrollados con la asistencia del modelo **Google Gemini**.
* **Referencias Teóricas:**
  * Oppenheim, A. V., Willsky, A. S., & Nawab, S. H. (1997). *Signals and Systems* (2nd ed.). Prentice Hall.
  * Cooley, J. W., & Tukey, J. W. (1965). *An algorithm for the machine calculation of complex Fourier series*. Mathematics of Computation.