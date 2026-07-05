# Reyerta

Reyerta es un videojuego de lucha 1v1 online para navegador, con backend en Python/Django y comunicacion en tiempo real mediante WebSockets.

## Direccion actual

- Pixel art retro.
- UI arcade con rojo y negro como colores principales.
- Fondos urbanos nocturnos sin textos legibles en carteles o grafitis.
- Personajes estilo indie beat-em-up: siluetas claras, cabezas y manos algo grandes, animables y expresivos.
- Modo local contra bot para probar controles.
- Modo online con salas privadas y matchmaking automatico.

## Controles previstos

- `W`, `A`, `S`, `D`: direccion.
- `Espacio`: salto.
- `J`: ataque rapido.
- `K`: ataque pesado.
- `L`: dash/esquivar.

## Requisitos

- Python 3.14+
- Django 6
- Channels 4

Instalacion:

```powershell
python -m pip install -r requirements.txt
```

## Desarrollo local

```powershell
python manage.py migrate
python manage.py runserver
```

Para probar desde otro ordenador de la misma red:

```powershell
python manage.py runserver 0.0.0.0:8000
```

Despues abre `http://IP-DE-TU-PC:8000` desde el otro equipo. Mas adelante documentaremos `ALLOWED_HOSTS`, firewall y despliegue ASGI estable con Daphne o Uvicorn.

## Hitos

1. Base del proyecto.
2. Usuarios y navegacion.
3. Diseno base del juego.
4. Controles y cliente jugable.
5. Modo local contra bot.
6. Motor de combate MVP.
7. Partidas online y matchmaking.
8. Tiempo real con WebSockets.
9. Acceso desde otros ordenadores.
10. Pulido jugable.
11. Pruebas y estabilidad.
12. GitHub y flujo de trabajo.
