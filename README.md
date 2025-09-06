# 🎮 PAC-MAN ARENA - Multijugador Local

Un juego de Pac-Man multijugador para 4 jugadores en modo local con editor de mapas integrado, desarrollado con JavaScript puro, HTML5 Canvas y CSS moderno.

## 🌟 Características

### 🎯 Gameplay
- **4 Jugadores simultáneos**: 1 Pac-Man vs 3 Fantasmas
- **Controles personalizados** para cada jugador
- **Sistema de puntuación** en tiempo real
- **Efectos visuales** con partículas y animaciones
- **Sonidos dinámicos** para una experiencia inmersiva

### 🛠️ Editor de Mapas
- **Editor visual integrado** para crear mapas personalizados
- **Herramientas de pincel**: Paredes, espacios vacíos, pellets y super-pellets
- **Acciones rápidas**: Borrar paredes o pellets con un click
- **Interfaz intuitiva** con modo de edición overlay
- **Guardado automático** de configuraciones

### 🎨 Diseño Moderno
- **Interfaz futurista** con degradados y efectos de luz
- **Tipografías espaciales** (Orbitron, Space Mono)
- **Colores neón** y efectos de brillo
- **Responsive design** adaptable a diferentes pantallas
- **Animaciones suaves** con CSS transitions

## 🕹️ Controles

### Pac-Man (Amarillo)
- **Teclado Numérico**: `8` (Arriba), `4` (Izquierda), `5` (Abajo), `6` (Derecha)
- **Alternativo**: Teclas `8`, `4`, `5`, `6` del teclado principal

### Fantasma 1 (Rojo)
- **WASD**: `W` (Arriba), `A` (Izquierda), `S` (Abajo), `D` (Derecha)

### Fantasma 2 (Rosa)
- **IJKL**: `I` (Arriba), `J` (Izquierda), `K` (Abajo), `L` (Derecha)

### Fantasma 3 (Cyan)
- **Flechas direccionales**: `↑` (Arriba), `←` (Izquierda), `↓` (Abajo), `→` (Derecha)

### Editor
- **Botón "🎨 Editar Mapa"** para activar el modo de edición
- **Click y arrastrar** para pintar en el mapa
- **Herramientas**: Pared, Vacío, Pellet, Super-pellet
- **Guardar/Cancelar** cambios

## 🚀 Instalación y Uso

### Requisitos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- No requiere instalación adicional

### Ejecución
1. Descarga o clona este repositorio
2. Abre `index.html` en tu navegador web
3. ¡Comienza a jugar inmediatamente!

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/PacManMultiplayer.git

# Navegar al directorio
cd PacManMultiplayer

# Abrir en navegador (ejemplo con Chrome)
start chrome index.html
```

## 📁 Estructura del Proyecto

```
PacManMultiplayer/
├── index.html          # Estructura HTML principal
├── script.js           # Lógica del juego y editor
├── styles.css          # Estilos y animaciones CSS
└── README.md           # Documentación del proyecto
```

## 🧠 Arquitectura Técnica

### JavaScript (script.js)
- **Sistema de entidades** orientado a objetos
- **Motor de física** para movimiento y colisiones
- **Sistema de input** multi-jugador
- **Editor de mapas** con herramientas visuales
- **Gestión de estado** del juego
- **Renderizado** optimizado con Canvas 2D

### CSS (styles.css)
- **Variables CSS** para tema consistente
- **Flexbox/Grid** para layouts responsivos
- **Animaciones CSS** para efectos visuales
- **Gradientes** y efectos de luz
- **Media queries** para adaptabilidad

### HTML (index.html)
- **Estructura semántica** bien organizada
- **Canvas HTML5** para renderizado del juego
- **Interfaz del editor** con controles intuitivos
- **HUD dinámico** para información del juego

## 🎮 Mecánicas del Juego

### Objetivo
- **Pac-Man**: Comer todos los pellets sin ser capturado
- **Fantasmas**: Capturar a Pac-Man antes de que termine

### Elementos del Juego
- **Pellets normales** (🟡): 10 puntos
- **Super-pellets** (⭐): 50 puntos + invulnerabilidad temporal
- **Paredes** (🧱): Bloquean el movimiento
- **Espacios vacíos**: Permiten movimiento libre

### Características Avanzadas
- **Detección de colisiones** precisa
- **Sistema de grid** para navegación
- **Efectos de partículas** al comer pellets
- **Transiciones suaves** entre celdas
- **Estados de juego** (normal, edición, game over)

## 🔧 Personalización

### Modificar Configuraciones
Edita las constantes en `script.js`:
```javascript
const TILE = 24;                 // Tamaño de celda
const PAC_SPEED = 120;          // Velocidad de Pac-Man
const GHOST_SPEED = 110;        // Velocidad de fantasmas
const FRIGHT_TIME = 8;          // Duración de invulnerabilidad
```

### Cambiar Colores
Modifica las variables CSS en `styles.css`:
```css
:root {
  --accent-blue: #00d4ff;
  --accent-yellow: #ffd700;
  --accent-pink: #ff6b9d;
  --accent-green: #4ade80;
}
```

## 🐛 Resolución de Problemas

### Problemas Comunes
- **Controles no responden**: Verifica que la ventana del juego tenga el foco
- **Rendimiento lento**: Cierra otras pestañas del navegador
- **Editor no funciona**: Asegúrate de hacer click en "🎨 Editar Mapa"

### Compatibilidad
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 🤝 Contribuir

1. Fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🎉 Agradecimientos

- Inspirado en el clásico Pac-Man de Namco
- Fuentes tipográficas de Google Fonts
- Iconos emoji para una interfaz amigable
- Comunidad de desarrolladores por feedback y testing

---

¡Disfruta jugando PAC-MAN ARENA! 🕹️👾
