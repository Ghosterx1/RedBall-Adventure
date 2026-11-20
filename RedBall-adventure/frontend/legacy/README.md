# Prototipo congelado (no tocar)

`redball-touch.html` es el experimento original de **1.623 líneas** (una sola
página, con la lógica, el dibujo y los controles incrustados) que se escribió
para probar el control táctil de "bounce".

Se mueve aquí **sin modificarlo** por tres motivos:

1. **No está enlazado desde ningún sitio**: era el 53 % del repositorio y nadie
   lo abría.
2. **Duplicaba** la física y los niveles del juego real, así que cada cambio
   había que hacerlo dos veces (o se olvidaba una).
3. Puede seguir consultándose si hace falta rescatar una idea de diseño.

El juego activo es el de `/index.html` (`src/`), y el prototipo anterior, que sí
funciona, sigue en `/Index/Index.html`.

> Si algún día hay que reutilizar algo de aquí, se **porta** al módulo
> correspondiente de `src/` y se añade una prueba. No se enlaza desde el juego.
