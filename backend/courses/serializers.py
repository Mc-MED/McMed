from rest_framework import serializers
from .models import Course, Enrollment, Instructor


class InstructorSerializer(serializers.ModelSerializer):
    full_name            = serializers.CharField(read_only=True)
    specializations      = serializers.ListField(child=serializers.CharField(), read_only=True)
    specializations_str  = serializers.CharField(read_only=True)

    class Meta:
        model  = Instructor
        fields = [
            'id', 'first_name', 'last_name', 'title', 'profession',
            'years_experience',
            'full_name', 'specializations', 'specializations_str',
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
    instructors         = serializers.SerializerMethodField()
    instructor_ids      = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    def get_instructors(self, obj):
        order = obj.instructor_order or []
        inst_map = {i.pk: i for i in obj.instructors.all()}
        ordered = [inst_map[pk] for pk in order if pk in inst_map]
        if not ordered:
            ordered = list(obj.instructors.all())
        return InstructorSerializer(ordered, many=True).data

    def _save_instructors(self, instance, instructor_ids):
        instance.instructor_order = instructor_ids
        instance.save(update_fields=['instructor_order'])
        instance.instructors.set(Instructor.objects.filter(pk__in=instructor_ids))

    def create(self, validated_data):
        instructor_ids = validated_data.pop('instructor_ids', [])
        instance = super().create(validated_data)
        if instructor_ids is not None:
            self._save_instructors(instance, instructor_ids)
        return instance

    def update(self, instance, validated_data):
        instructor_ids = validated_data.pop('instructor_ids', None)
        instance = super().update(instance, validated_data)
        if instructor_ids is not None:
            self._save_instructors(instance, instructor_ids)
        return instance

    class Meta:
        model  = Course
        fields = [
            'id', 'name', 'course_type', 'course_type_display',
            'city', 'max_participants', 'price', 'is_active', 'created_at',
            'course_days', 'start_date', 'end_date',
            'exam_date', 'exam_time', 'exam_location', 'whatsapp_link',
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
    course_name            = serializers.SerializerMethodField()
    deletion_reason_display = serializers.SerializerMethodField()

    def get_course_name(self, obj):
        return obj.course.name if obj.course_id else None

    def get_deletion_reason_display(self, obj):
        return obj.get_deletion_reason_display() if obj.deletion_reason else ''

    class Meta:
        model  = Enrollment
        fields = [
            'id', 'course', 'course_name',
            'first_name', 'last_name', 'pesel', 'birth_date',
            'email', 'phone',
            'zip_code', 'city', 'street', 'house_number', 'apartment_number',
            'photo_consent', 'deposit_paid', 'created_at',
            'is_deleted', 'deleted_at', 'deletion_reason', 'deletion_reason_display',
        ]
        read_only_fields = ['id', 'course_name', 'created_at', 'is_deleted', 'deleted_at', 'deletion_reason', 'deletion_reason_display']

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


class MyEnrollmentSerializer(serializers.ModelSerializer):
    course_name         = serializers.SerializerMethodField()
    course_type         = serializers.SerializerMethodField()
    course_type_display = serializers.SerializerMethodField()
    start_date          = serializers.SerializerMethodField()
    end_date            = serializers.SerializerMethodField()
    exam_date           = serializers.SerializerMethodField()
    exam_location       = serializers.SerializerMethodField()
    course_city         = serializers.SerializerMethodField()
    price               = serializers.SerializerMethodField()
    course_days         = serializers.SerializerMethodField()

    def get_course_name(self, obj):
        return obj.course.name if obj.course else None

    def get_course_type(self, obj):
        return obj.course.course_type if obj.course else None

    def get_course_type_display(self, obj):
        return obj.course.get_course_type_display() if obj.course else None

    def get_start_date(self, obj):
        return str(obj.course.start_date) if obj.course and obj.course.start_date else None

    def get_end_date(self, obj):
        return str(obj.course.end_date) if obj.course and obj.course.end_date else None

    def get_exam_date(self, obj):
        return str(obj.course.exam_date) if obj.course and obj.course.exam_date else None

    def get_exam_location(self, obj):
        return obj.course.exam_location if obj.course else None

    def get_course_city(self, obj):
        return obj.course.city if obj.course else None

    def get_price(self, obj):
        return str(obj.course.price) if obj.course else None

    def get_course_days(self, obj):
        return obj.course.course_days if obj.course else []

    def get_whatsapp_link(self, obj):
        return obj.course.whatsapp_link if obj.course else ''

    whatsapp_link = serializers.SerializerMethodField()

    class Meta:
        model  = Enrollment
        fields = [
            'id', 'course', 'course_name', 'course_type', 'course_type_display',
            'course_city', 'start_date', 'end_date', 'exam_date', 'exam_location',
            'price', 'course_days', 'whatsapp_link',
            'first_name', 'last_name', 'deposit_paid', 'photo_consent', 'created_at',
        ]
