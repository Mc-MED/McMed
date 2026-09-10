from django.urls import path
from . import views

urlpatterns = [
    path('courses/<int:course_id>/certyfikaty-zip/', views.download_certificates_zip, name='certificates-zip'),
    path('courses/<int:course_id>/<str:doc_name>/', views.download_document, name='document-download'),
    path('courses/<int:course_id>/pdf/<str:doc_name>/', views.download_document_pdf, name='document-download-pdf'),
    path('courses/<int:course_id>/xlsx/<str:doc_name>/', views.download_xlsx, name='document-download-xlsx'),
    path('courses/<int:course_id>/xlsx-per-enrollment/<str:doc_name>/', views.download_xlsx_per_enrollment, name='document-download-xlsx-per-enrollment'),
    path('enrollments/<int:enrollment_id>/<str:doc_name>/', views.download_certificate, name='certificate-download'),
    # Tematy i pliki
    path('admin/topics/', views.admin_topics, name='admin-topics'),
    path('admin/topics/<int:topic_id>/', views.admin_topic_detail, name='admin-topic-detail'),
    path('admin/topics/<int:topic_id>/files/', views.admin_topic_file_upload, name='admin-topic-file-upload'),
    path('admin/topic-files/<int:file_id>/', views.admin_topic_file_detail, name='admin-topic-file-detail'),
    path('topics/', views.participant_topics, name='participant-topics'),
    path('topic-files/<int:file_id>/', views.participant_topic_file, name='participant-topic-file'),
    path('progress/', views.participant_progress, name='participant-progress'),
    path('quiz-progress/', views.quiz_progress, name='quiz-progress'),
    path('topic-files/<int:file_id>/progress/', views.participant_toggle_progress, name='participant-toggle-progress'),
]
