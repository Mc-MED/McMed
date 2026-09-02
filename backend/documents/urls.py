from django.urls import path
from . import views

urlpatterns = [
    path('courses/<int:course_id>/<str:doc_name>/', views.download_document, name='document-download'),
    path('courses/<int:course_id>/pdf/<str:doc_name>/', views.download_document_pdf, name='document-download-pdf'),
    path('courses/<int:course_id>/xlsx/<str:doc_name>/', views.download_xlsx, name='document-download-xlsx'),
    path('courses/<int:course_id>/xlsx-per-enrollment/<str:doc_name>/', views.download_xlsx_per_enrollment, name='document-download-xlsx-per-enrollment'),
    path('enrollments/<int:enrollment_id>/<str:doc_name>/', views.download_certificate, name='certificate-download'),
    path('presentation/', views.participant_presentation, name='presentation-view'),
    path('admin/presentation/', views.admin_presentation, name='admin-presentation'),
]
