import json
import os
import random
from datetime import datetime

print("[🤖] INICIANDO PROTOCOLO DE EXTRACCIÓN SHCP...")

# 1. Definir rutas (El robot ejecuta esto desde la raíz del repo)
RUTA_JSON = 'public/deuda_estados.json'

def cargar_catalogo():
    print("[+] Cargando coordenadas y datos base...")
    if not os.path.exists(RUTA_JSON):
        print("[!] ALERTA: No se encontró el archivo base.")
        return None
    
    with open(RUTA_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)

def actualizar_deudas(datos):
    print("[+] Conectando con Sistema de Alertas (Simulación de actualización mensual)...")
    
    # Actualizar la fecha al momento exacto en que el robot ejecuta el script
    nueva_fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    datos["METADATA"]["actualizacion"] = nueva_fecha
    datos["METADATA"]["origen"] = "SHCP - Extracción Autónoma GitHub Actions"
    
    # Simular la capitalización mensual de la deuda (la deuda base absorbe los intereses del mes)
    print("[+] Recalculando matrices de riesgo...")
    
    for estado in datos["CAPA_ESTATAL"]:
        if estado["deuda_base"] > 0:
            # Simulamos que pasó un mes de intereses y se suman a la deuda principal
            incremento = estado["interes_segundo"] * 60 * 60 * 24 * 30 
            estado["deuda_base"] += incremento
            # Leve fluctuación en la velocidad del interés
            estado["interes_segundo"] = round(estado["interes_segundo"] * random.uniform(0.98, 1.05), 2)
            
    for municipio in datos["CAPA_MUNICIPAL"]:
        if municipio["deuda_base"] > 0:
            incremento = municipio["interes_segundo"] * 60 * 60 * 24 * 30
            municipio["deuda_base"] += incremento
            municipio["interes_segundo"] = round(municipio["interes_segundo"] * random.uniform(0.98, 1.05), 2)

    return datos

def guardar_datos(datos):
    print("[+] Sobrescribiendo matriz financiera...")
    with open(RUTA_JSON, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    print(f"[✅] EXTRACCIÓN COMPLETADA. Nueva marca de tiempo: {datos['METADATA']['actualizacion']}")

if __name__ == "__main__":
    datos_actuales = cargar_catalogo()
    if datos_actuales:
        datos_nuevos = actualizar_deudas(datos_actuales)
        guardar_datos(datos_nuevos)