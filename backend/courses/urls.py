from django.urls import path
from . import views

urlpatterns = [
    path('', views.PublicCourseListView.as_view(), name='course-list'),
    path('enrollments/', views.PublicEnrollView.as_view(), name='enroll'),
    path('enrollments/list/', views.AdminEnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/send-email/', views.send_email_to_enrollments, name='enrollment-send-email'),
    path('enrollments/<int:pk>/', views.AdminEnrollmentDeleteView.as_view(), name='enrollment-delete'),
    path('admin/', views.AdminCourseListView.as_view(), name='admin-course-list'),
    path('admin/create/', views.AdminCourseCreateView.as_view(), name='admin-course-create'),
    path('admin/<int:pk>/', views.AdminCourseDetailView.as_view(), name='admin-course-detail'),
    path('instructors/', views.InstructorListCreateView.as_view(), name='instructor-list'),
    path('instructors/<int:pk>/', views.InstructorDetailView.as_view(), name='instructor-detail'),
]
