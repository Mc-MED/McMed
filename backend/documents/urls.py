from django.urls import path
from . import views

urlpatterns = [
    path('courses/<int:course_id>/<str:doc_name>/', views.download_document, name='document-download'),
    path('courses/<int:course_id>/pdf/<str:doc_name>/', views.download_document_pdf, name='document-download-pdf'),
    path('courses/<int:course_id>/xlsx/<str:doc_name>/', views.download_xlsx, name='document-download-xlsx'),
]
