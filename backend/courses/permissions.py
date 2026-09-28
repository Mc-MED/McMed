from rest_framework.permissions import BasePermission


class IsInstructor(BasePermission):
    """Zalogowany prowadzący — konto powiązane z instruktorem."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and hasattr(user, 'instructor_profile'))
