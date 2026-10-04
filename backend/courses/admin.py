from django.contrib import admin
from .models import Course, Enrollment


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display  = ['name', 'course_type', 'start_date', 'end_date', 'city', 'spots_left', 'price', 'is_active']
    list_filter   = ['course_type', 'is_active']
    search_fields = ['name', 'location']
    list_editable = ['is_active']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display  = ['last_name', 'first_name', 'pesel', 'course', 'city', 'created_at']
    list_filter   = ['course']
    search_fields = ['last_name', 'first_name', 'pesel']
    readonly_fields = ['created_at']
