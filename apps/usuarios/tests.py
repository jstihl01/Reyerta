from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


class UsuariosViewsTests(TestCase):
    def test_registro_creates_user_and_logs_in(self):
        response = self.client.post(
            reverse("usuarios:registro"),
            {
                "username": "nuevo",
                "email": "nuevo@example.com",
                "password1": "ClaveSegura123",
                "password2": "ClaveSegura123",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(username="nuevo").exists())
        self.assertContains(response, "Sesion iniciada: nuevo")

    def test_login_view_authenticates_existing_user(self):
        User.objects.create_user(username="jugador", password="ClaveSegura123")

        response = self.client.post(
            reverse("usuarios:login"),
            {"username": "jugador", "password": "ClaveSegura123"},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sesion iniciada: jugador")

    def test_logout_returns_to_anonymous_home(self):
        user = User.objects.create_user(username="jugador", password="ClaveSegura123")
        self.client.force_login(user)

        response = self.client.post(reverse("usuarios:logout"), follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Entrar")
        self.assertNotContains(response, "Sesion iniciada")
