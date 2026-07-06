from django.urls import path

from . import views


app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("local/", views.local, name="local"),
    path("buscar-partida/", views.buscar_partida, name="buscar_partida"),
    path("crear-sala/", views.crear_sala, name="crear_sala"),
    path("unirse/", views.unirse, name="unirse"),
]
