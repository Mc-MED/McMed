from django.urls import path
from . import views

urlpatterns = [
    path('', views.PublicCourseListView.as_view(), name='course-list'),
    path('enrollments/', views.PublicEnrollView.as_view(), name='enroll'),
    path('enrollments/list/', views.AdminEnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/admin-create/', views.AdminEnrollmentCreateView.as_view(), name='enrollment-admin-create'),
    path('enrollments/send-email/', views.send_email_to_enrollments, name='enrollment-send-email'),
    path('enrollments/send-sms/', views.send_sms_to_enrollments, name='enrollment-send-sms'),
    path('enrollments/<int:pk>/', views.AdminEnrollmentDetailView.as_view(), name='enrollment-detail'),
    path('enrollments/<int:pk>/remove/', views.soft_delete_enrollment, name='enrollment-soft-delete'),
    path('enrollments/<int:pk>/anonymize/', views.anonymize_enrollment, name='enrollment-anonymize'),
    path('enrollments/<int:pk>/restore/', views.restore_enrollment, name='enrollment-restore'),
    path('my-enrollments/', views.MyEnrollmentsView.as_view(), name='my-enrollments'),
    path('my-enrollments/<int:pk>/cancel/', views.cancel_my_enrollment, name='my-enrollment-cancel'),
    path('my-profile/', views.MyProfileView.as_view(), name='my-profile'),
    path('enroll-me/', views.enroll_me, name='enroll-me'),
    path('admin/', views.AdminCourseListView.as_view(), name='admin-course-list'),
    path('admin/create/', views.AdminCourseCreateView.as_view(), name='admin-course-create'),
    path('admin/<int:pk>/', views.AdminCourseDetailView.as_view(), name='admin-course-detail'),
    path('instructors/', views.InstructorListCreateView.as_view(), name='instructor-list'),
    path('instructors/<int:pk>/', views.InstructorDetailView.as_view(), name='instructor-detail'),
]
