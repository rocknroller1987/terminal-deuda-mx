import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

// 1. INICIALIZACIÓN DEL MAPA
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', 
  center: [-102.552784, 23.634501], 
  zoom: 4.5,
  pitch: 35, 
  maxZoom: 14,
  minZoom: 4
});

// 2. DICCIONARIO DE ÍCONOS (8 MACRO-CATEGORÍAS)
const iconosSVG = {
  'icon-homicidio': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12l-2-2h-3v-2c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v6h5v4h4v-4h3l2 2h5v-4z"/></svg>',
  'icon-secuestro': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.33.26 2.61.74 3.77L12 22l9.26-6.23c.48-1.16.74-2.44.74-3.77 0-5.52-4.48-10-10-10zm-3 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>',
  'icon-feminicidio': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c-3.87 0-7 3.13-7 7 0 3.53 2.61 6.43 6 6.92V18H9v2h2v2h2v-2h2v-2h-2v-2.08c3.39-.49 6-3.39 6-6.92 0-3.87-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
  'icon-extorsion': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.01.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.27-.26.35-.65.24-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg>',
  'icon-robo': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>',
  'icon-narco': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.96.3 1.44.3c6.1 0 10.9-5 10.9-11v-1h-2z"/></svg>',
  'icon-sexual': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
  'icon-otros': 'data:image/svg+xml;utf8,<svg fill="%23FFFFFF" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>'
};

function cargarIconos(mapa) {
  for (const [nombre, url] of Object.entries(iconosSVG)) {
    let img = new Image(24, 24);
    img.src = url;
    img.onload = () => mapa.addImage(nombre, img);
  }
}

// 3. MOTOR PRINCIPAL
map.on('load', async () => {
  cargarIconos(map);

  // Carga de la base de datos
  const response = await fetch('/data_espectro_completo.json');
  const datosCriminales = await response.json();

  map.addSource('puntos-crimen', { type: 'geojson', data: datosCriminales });

// CAPA 1: HEATMAP (Brillo reducido al 50%)
map.addLayer({
  id: 'capa-heatmap', type: 'heatmap', source: 'puntos-crimen',
  layout: { 'visibility': 'none' },
  paint: {
    // Mantenemos la sensibilidad al máximo para que los homicidios sigan detectándose
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensidad'], 0, 0, 50, 1],
    
    // 1. Intensidad cortada a la mitad (bajamos el arranque de 3 a 1.5, y el tope de 10 a 5)
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 14, 5],
    
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0, 0, 0, 0)',
      0.01, '#06b6d4', 
      0.2, '#a855f7',  
      0.5, '#ff0055',  
      0.8, '#ffffff'   
    ],
    
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 20, 14, 55],
    
    // 2. Opacidad reducida exactamente a la mitad (de 0.90 a 0.45)
    'heatmap-opacity': 0.45
  }
});

  // CAPA 2: GLOW
  map.addLayer({
    id: 'capa-glow', type: 'circle', source: 'puntos-crimen',
    layout: { 'visibility': 'visible' },
    paint: {
      'circle-color': [
        'match', ['get', 'tipo'],
        'Homicidio doloso', '#ff0055',
        'Secuestro', '#a855f7',
        'Feminicidio', '#ec4899',
        'Extorsion', '#f97316',
        'Robo', '#eab308',
        'Narcomenudeo', '#22c55e',
        'Delitos Sexuales', '#3b82f6',
        'Otros Delitos', '#94a3b8',
        '#ffffff'
      ],
      'circle-opacity': 0.15, 'circle-blur': 0.8, 'circle-radius': 10
    }
  });

  // CAPA 3: ICONOS
  map.addLayer({
    id: 'capa-iconos', type: 'symbol', source: 'puntos-crimen',
    layout: { 
      'visibility': 'visible', 
      'icon-image': [
        'match', ['get', 'tipo'],
        'Homicidio doloso', 'icon-homicidio',
        'Secuestro', 'icon-secuestro',
        'Feminicidio', 'icon-feminicidio',
        'Extorsion', 'icon-extorsion',
        'Robo', 'icon-robo',
        'Narcomenudeo', 'icon-narco',
        'Delitos Sexuales', 'icon-sexual',
        'Otros Delitos', 'icon-otros',
        'icon-otros'
      ], 
      'icon-size': 0.6, 
      'icon-allow-overlap': false 
    }
  });

  // --- LOGICA DEL HUD (INTERACCIÓN) ---
  map.on('mousemove', 'capa-iconos', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const props = e.features[0].properties;
    
    document.getElementById('hud-region').innerText = props.municipio.toUpperCase();
    document.getElementById('hud-status').innerHTML = `
      <span style="color: #06b6d4; font-weight: bold;">ALERTA: ${props.tipo.toUpperCase()}</span><br>
      <span style="color: #aaa; font-size: 12px;">Volumen Total Registrado: <span style="color: white;">${props.intensidad} casos</span></span>
    `;
  });

  map.on('mouseleave', 'capa-iconos', () => {
    map.getCanvas().style.cursor = '';
    document.getElementById('hud-region').innerText = 'MÉXICO (VISTA GENERAL)';
    document.getElementById('hud-status').innerHTML = 'MONITOREO ACTIVO';
  });

  // --- SISTEMA DE CAMBIO DE VISTA (Calor vs Íconos) ---
  document.querySelectorAll('input[name="map-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const modo = e.target.value;
      if (modo === 'calor') {
        map.setLayoutProperty('capa-iconos', 'visibility', 'none');
        map.setLayoutProperty('capa-glow', 'visibility', 'none');
        map.setLayoutProperty('capa-heatmap', 'visibility', 'visible');
      } else {
        map.setLayoutProperty('capa-heatmap', 'visibility', 'none');
        map.setLayoutProperty('capa-iconos', 'visibility', 'visible');
        map.setLayoutProperty('capa-glow', 'visibility', 'visible');
      }
    });
  });

  // --- SISTEMA DE FILTRADO TÁCTICO ---
  function actualizarCapasVisibles() {
    const checkboxes = document.querySelectorAll('.filtro-delito:checked');
    const delitosActivos = Array.from(checkboxes).map(cb => cb.value);

    if (delitosActivos.length === 0) {
      map.setFilter('capa-glow', ['==', 'tipo', 'ninguno']);
      map.setFilter('capa-iconos', ['==', 'tipo', 'ninguno']);
      map.setFilter('capa-heatmap', ['==', 'tipo', 'ninguno']);
      return;
    }

    const filtro = ['in', ['get', 'tipo'], ['literal', delitosActivos]];
    map.setFilter('capa-glow', filtro);
    map.setFilter('capa-iconos', filtro);
    map.setFilter('capa-heatmap', filtro);
  }

  document.querySelectorAll('.filtro-delito').forEach(checkbox => {
    checkbox.addEventListener('change', actualizarCapasVisibles);
  });

  actualizarCapasVisibles();
}); // <--- FINAL DE LA CARGA DEL MAPA

// ==========================================
// INTERFAZ: LÓGICA PARA MINIMIZAR EL PANEL (TOTALMENTE INDEPENDIENTE)
// ==========================================
const btnMinimizar = document.getElementById('btn-minimizar');
const panelContenido = document.getElementById('panel-contenido');

if (btnMinimizar && panelContenido) {
  btnMinimizar.addEventListener('click', () => {
    const estadoActual = window.getComputedStyle(panelContenido).display;
    
    if (estadoActual === 'none') {
      panelContenido.style.display = 'block';
      btnMinimizar.innerText = '_';
      btnMinimizar.style.color = '#06b6d4';
    } else {
      panelContenido.style.display = 'none';
      btnMinimizar.innerText = '▼';
      btnMinimizar.style.color = '#ff0055';
    }
  });
}