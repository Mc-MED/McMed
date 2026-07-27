from rest_framework import serializers
from .models import Course, Enrollment


class CourseSerializer(serializers.ModelSerializer):
    spots_left          = serializers.IntegerField(read_only=True)
    is_full             = serializers.BooleanField(read_only=True)
    course_type_display = serializers.CharField(source='get_course_type_display', read_only=True)

    class Meta:
        model  = Course
        fields = [
            'id', 'name', 'course_type', 'course_type_display',
            'city', 'course_days', 'start_date', 'end_date',
            'exam_date', 'exam_time', 'exam_location',
            'max_participants', 'spots_left', 'is_full', 'price',
        ]


class AdminCourseSerializer(serializers.ModelSerializer):
    spots_left          = serializers.IntegerField(read_only=True)
    instructors_count   = serializers.IntegerField(read_only=True)
    course_type_display = serializers.CharField(source='get_course_type_display', read_only=True)

    class Meta:
        model  = Course
        fields = [
            'id', 'name', 'course_type', 'course_type_display',
            'city', 'max_participants', 'price', 'is_active', 'created_at',
            'course_days', 'start_date', 'end_date',
            'exam_date', 'exam_time', 'exam_location',
            'entity_director', 'academic_director',
            'instructors', 'instructors_count',
            'psychologist',
            'committee_chair', 'committee_member1', 'committee_member2',
            'spots_left',
        ]
        read_only_fields = ['id', 'created_at', 'start_date', 'end_date']

    def validate_course_days(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Podaj listę dat.')
        filled = [d for d in value if d]
        if len(filled) != 6:
            raise serializers.ValidationError('Kurs musi mieć dokładnie 6 dni szkoleniowych.')
        return value

    def validate_instructors(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Podaj listę prowadzących.')
        return value


class EnrollmentSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)

    class Meta:
        model  = Enrollment
        fields = [
            'id', 'course', 'course_name',
            'first_name', 'last_name', 'pesel', 'birth_date',
            'email', 'phone',
            'zip_code', 'city', 'street', 'house_number', 'apartment_number',
            'photo_consent', 'created_at',
        ]
        read_only_fields = ['id', 'course_name', 'created_at']

    def validate_pesel(self, value):
        if not value.isdigit() or len(value) != 11:
            raise serializers.ValidationError('PESEL musi składać się z 11 cyfr.')
        return value

    def validate(self, data):
        course = data.get('course')
        if course and course.is_full:
            raise serializers.ValidationError(
                {'course': 'Brak wolnych miejsc na wybranym kursie.'}
            )
        return data
