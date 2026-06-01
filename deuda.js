import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

// 1. INICIALIZACIÓN DEL MAPA FINANCIERO (Mismo estilo que delitos)
const map = new maplibregl.Map({
  container: 'mapa-financiero',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-102.552784, 23.634501],
  zoom: 4.5,
  pitch: 20,
  maxZoom: 14,
  minZoom: 4
});

// --- VARIABLES GLOBALES DEL MOTOR DE RELOJES ---
let datosFinancieros = null;
let deudaBaseActual = 0;
let incrementoPorMilisegundo = 0;
let poblacionActual = 1;
let timestampReporte = 0;

// 2. CONSTRUCCIÓN DE LA CAPA GEOJSON DESDE EL JSON DE DEUDA
function convertirA_GeoJSON(datosOriginales) {
  const puntosGeoJSON = [];
  
  // Procesamos la capa de estados
  datosOriginales.CAPA_ESTATAL.forEach(est => {
    puntosGeoJSON.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [est.lng, est.lat] },
      properties: { ...est, tipoCapa: "estatal", intensidad_heatmap: est.deuda_base / 1000000000 }
    });
  });

  // Procesamos la capa municipal
  datosOriginales.CAPA_MUNICIPAL.forEach(mun => {
    puntosGeoJSON.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [mun.lng, mun.lat] },
      properties: { ...mun, nombre: mun.municipio, tipoCapa: "municipal", intensidad_heatmap: mun.deuda_base / 100000000 }
    });
  });

  return { type: "FeatureCollection", features: puntosGeoJSON };
}
// 3. CARGA DE DATOS Y RENDERIZADO BIFÁSICO (ESTADOS VS MUNICIPIOS)
map.on('load', async () => {
  // Cargar el JSON de Hacienda
  const response = await fetch('/deuda_estados.json');
  datosFinancieros = await response.json();
  
  timestampReporte = new Date(datosFinancieros.METADATA.actualizacion).getTime();

  const defaultData = datosFinancieros.CAPA_ESTATAL.find(e => e.id === "NL");
  if(defaultData) arrancarReloj(defaultData);

  const geojsonData = convertirA_GeoJSON(datosFinancieros);
  map.addSource('puntos-deuda', { type: 'geojson', data: geojsonData });
  
  generarRanking(datosFinancieros); // <--- Dispara el cálculo del ranking

  // ==========================================
  // CAPA 1: MACRO (ESTADOS) - Visible de Zoom 0 a 7
  // ==========================================
  map.addLayer({
    id: 'calor-estatal',
    type: 'heatmap',
    source: 'puntos-deuda',
    maxzoom: 7, // El punto crítico donde desaparecen
    filter: ['==', 'tipoCapa', 'estatal'], // Solo lee estados
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensidad_heatmap'], 0, 0, 100, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 7, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)', 
        0.2, '#eab308', // Amarillo
        0.5, '#ff0055', // Rojo Neón
        0.8, '#ffffff'  // Blanco Térmico
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 35, 7, 80],
      'heatmap-opacity': 0.8
    }
  });

  map.addLayer({
    id: 'interactivo-estatal',
    type: 'circle',
    source: 'puntos-deuda',
    maxzoom: 7,
    filter: ['==', 'tipoCapa', 'estatal'],
    paint: { 'circle-radius': 30, 'circle-color': 'transparent' }
  });

  // ==========================================
  // CAPA 2: MICRO (MUNICIPIOS) - Visible de Zoom 7 en adelante
  // ==========================================
  map.addLayer({
    id: 'calor-municipal',
    type: 'heatmap',
    source: 'puntos-deuda',
    minzoom: 7, // El punto crítico donde aparecen
    filter: ['==', 'tipoCapa', 'municipal'], // Solo lee municipios
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensidad_heatmap'], 0, 0, 20, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 14, 5],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)', 
        0.2, '#06b6d4', // Cian (Cambio visual para indicar Nivel Municipal)
        0.5, '#a855f7', // Púrpura
        0.8, '#ffffff'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 20, 14, 60],
      'heatmap-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'interactivo-municipal',
    type: 'circle',
    source: 'puntos-deuda',
    minzoom: 7,
    filter: ['==', 'tipoCapa', 'municipal'],
    paint: { 'circle-radius': 20, 'circle-color': 'transparent' }
  });

  // ==========================================
  // INTERACCIÓN Y RADAR (SINTAXIS BLINDADA)
  // ==========================================
  const capasBlancos = ['interactivo-estatal', 'interactivo-municipal'];

  // Iteramos sobre las capas para anclar los eventos a cada una de forma independiente
  capasBlancos.forEach(capa => {
    
    // 1. El clic para disparar los relojes fatídicos
    map.on('click', capa, (e) => {
      const propiedades = e.features[0].properties;
      arrancarReloj(propiedades);
    });

    // 2. El radar flotante (Hover)
    map.on('mousemove', capa, (e) => {
      map.getCanvas().style.cursor = 'crosshair';
      const props = e.features[0].properties;
      const hud = document.getElementById('hud-financiero');
      
      if(hud) {
        hud.style.opacity = '1';
        document.getElementById('hud-fin-region').innerText = props.nombre.toUpperCase();
        
        let colorSemaforo = '#22c55e';
        if(props.deuda_base > 0) colorSemaforo = '#eab308';
        if(props.deuda_base > 50000000000 || props.deuda_base === 1800000000) colorSemaforo = '#ff0055';
        
        document.getElementById('hud-fin-status').innerHTML = `<span style="color: ${colorSemaforo}; font-weight: bold;">OBJETIVO FIJADO [${props.tipoCapa.toUpperCase()}]</span>`;
      }
    });

    // 3. Limpiar la mira al salir del objetivo
    map.on('mouseleave', capa, () => {
      map.getCanvas().style.cursor = '';
      const hud = document.getElementById('hud-financiero');
      if(hud) hud.style.opacity = '0';
    });
    
  });
});
// 4. LÓGICA DEL MOTOR DE RELOJES
function arrancarReloj(datos) {
  document.getElementById('txt-estado-seleccionado').textContent = datos.nombre.toUpperCase();
  
  const tag = document.getElementById('tag-semaforo');
  const deuda = datos.deuda_base;
  
  tag.className = "semaforo-tag";
  if (deuda > 50000000000 || deuda === 1800000000) {
    tag.textContent = "ALERTA: CRÍTICA"; tag.classList.add("tag-rojo");
  } else if (deuda > 0) {
    tag.textContent = "ALERTA: OBSERVACIÓN"; tag.classList.add("tag-amarillo");
  } else {
    tag.textContent = "FINANZAS ESTABLES"; tag.classList.add("tag-verde");
  }

  document.getElementById('txt-velocidad').textContent = `▲ $${datos.interes_segundo.toFixed(2)} pesos / seg`;

  // Actualizar variables de cálculo
  deudaBaseActual = datos.deuda_base;
  incrementoPorMilisegundo = datos.interes_segundo / 1000;
  poblacionActual = datos.poblacion;
}

// Bucle de renderizado continuo (60 FPS)
function actualizarRelojContinuo() {
  if (deudaBaseActual >= 0 && timestampReporte > 0) {
    const ahora = Date.now();
    const milisegundosTranscurridos = ahora - timestampReporte;
    const deudaEnVivo = deudaBaseActual + (incrementoPorMilisegundo * milisegundosTranscurridos);
    const cuotaPerCapita = deudaEnVivo / poblacionActual;

    const formateador = new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', minimumFractionDigits: 2
    });

    document.getElementById('clk-deuda-total').textContent = formateador.format(deudaEnVivo);
    document.getElementById('clk-cuota-ciudadana').textContent = formateador.format(cuotaPerCapita);
  }
  requestAnimationFrame(actualizarRelojContinuo);
}

// Arrancamos el bucle de renderizado en cuanto cargue el script
requestAnimationFrame(actualizarRelojContinuo);

// 5. GENERADOR DE RANKING NACIONAL
function generarRanking(datos) {
  // Clonamos y ordenamos la lista de estados de mayor a menor deuda
  const ranking = [...datos.CAPA_ESTATAL]
    .sort((a, b) => b.deuda_base - a.deuda_base)
    .slice(0, 5); // Tomamos solo los 5 peores

  const contenedor = document.getElementById('lista-ranking');
  contenedor.innerHTML = ''; // Limpiamos el texto de procesamiento

  const formateador = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0
  });

  ranking.forEach((estado, index) => {
    // Calculamos el porcentaje respecto al primer lugar para hacer una pequeña barra visual
    const porcentaje = (estado.deuda_base / ranking[0].deuda_base) * 100;
    
    contenedor.innerHTML += `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <span style="color: #fff;">${index + 1}. ${estado.nombre.toUpperCase()}</span>
        <span style="color: #ff0055; font-weight: bold;">${formateador.format(estado.deuda_base)}</span>
      </div>
      <div style="width: 100%; background: #111; height: 4px; margin-bottom: 10px; border-radius: 2px;">
        <div style="width: ${porcentaje}%; background: #ff0055; height: 100%; border-radius: 2px;"></div>
      </div>
    `;
  });
}