from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


class CoreViewsTests(TestCase):
    def test_home_shows_auth_options_for_anonymous_users(self):
        response = self.client.get(reverse("core:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "REYERTA")
        self.assertContains(response, "Entrar")
        self.assertContains(response, "Crear cuenta")
        self.assertNotContains(response, "Buscar partida")

    def test_home_shows_game_menu_for_authenticated_users(self):
        user = User.objects.create_user(username="director", password="ClaveSegura123")
        self.client.force_login(user)

        response = self.client.get(reverse("core:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sesion iniciada: director")
        self.assertContains(response, "Local")
        self.assertContains(response, "Buscar partida")
        self.assertContains(response, "Crear sala")
        self.assertContains(response, "Unirse")

    def test_game_menu_routes_require_login(self):
        protected_routes = [
            reverse("core:local"),
            reverse("core:buscar_partida"),
            reverse("core:crear_sala"),
            reverse("core:unirse"),
        ]

        for route in protected_routes:
            with self.subTest(route=route):
                response = self.client.get(route)
                self.assertEqual(response.status_code, 302)
                self.assertIn(reverse("usuarios:login"), response["Location"])

    def test_authenticated_user_can_open_placeholder_routes(self):
        user = User.objects.create_user(username="player", password="ClaveSegura123")
        self.client.force_login(user)

        response = self.client.get(reverse("core:local"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "fight-canvas")
        self.assertContains(response, "local_fight.js")
        self.assertContains(response, "WASD")
