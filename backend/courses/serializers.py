from rest_framework import serializers
from .models import Course, Enrollment, Instructor


class InstructorSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    specializations = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model  = Instructor
        fields = [
            'id', 'first_name', 'last_name', 'title', 'profession',
            'full_name', 'specializations',
            'spec_L', 'spec_P', 'spec_Ps', 'spec_R', 'spec_Rt',
            'spec_Rch', 'spec_Re', 'spec_Rwo', 'spec_Rwy',
        ]


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
    instructors         = InstructorSerializer(many=True, read_only=True)
    instructor_ids      = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Instructor.objects.all(),
        source='instructors',
        write_only=True,
        required=False,
    )

    class Meta:
        model  = Course
        fields = [
            'id', 'name', 'course_type', 'course_type_display',
            'city', 'max_participants', 'price', 'is_active', 'created_at',
            'course_days', 'start_date', 'end_date',
            'exam_date', 'exam_time', 'exam_location',
            'entity_director', 'academic_director',
            'instructors', 'instructor_ids', 'instructors_count',
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
