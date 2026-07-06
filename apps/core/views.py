from django.contrib.auth.decorators import login_required
from django.shortcuts import render


def home(request):
    return render(request, "core/home.html")


@login_required
def local(request):
    return render(request, "core/local.html")


@login_required
def buscar_partida(request):
    return render(
        request,
        "core/placeholder.html",
        {
            "title": "Buscar partida",
            "eyebrow": "Matchmaking online",
            "body": "Aqui vivira la cola automatica que emparejara a dos jugadores en tiempo real.",
        },
    )


@login_required
def crear_sala(request):
    return render(
        request,
        "core/placeholder.html",
        {
            "title": "Crear sala",
            "eyebrow": "Duelo privado",
            "body": "Aqui crearemos una sala privada con codigo o enlace para invitar a otro jugador.",
        },
    )


@login_required
def unirse(request):
    return render(
        request,
        "core/placeholder.html",
        {
            "title": "Unirse",
            "eyebrow": "Codigo de sala",
            "body": "Aqui introduciremos el codigo de una sala privada para entrar a una partida existente.",
        },
    )

