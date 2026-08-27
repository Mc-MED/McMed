import math
import datetime
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from .fields import EncryptedCharField

SPECIALIZATION_CODES = ['L', 'P', 'Ps', 'R', 'Rt', 'Rch', 'Re', 'Rwo', 'Rwy']

SPECIALIZATION_LABELS = {
    'L':   'L – lekarz systemu',
    'P':   'P – pielęgniarka systemu',
    'Ps':  'Ps – psycholog',
    'R':   'R – ratownik',
    'Rt':  'Rt – specjalista z zakresu ratownictwa technicznego',
    'Rch': 'Rch – specjalista z zakresu ratownictwa chemicznego',
    'Re':  'Re – specjalista z zakresu ratownictwa ekologicznego',
    'Rwo': 'Rwo – specjalista z zakresu ratownictwa wodnego',
    'Rwy': 'Rwy – specjalista z zakresu ratownictwa wysokościowego',
}


class Instructor(models.Model):
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    title      = models.CharField(max_length=100, blank=True)
    profession = models.CharField(max_length=200, blank=True)

    # Specjalizacje
    spec_L   = models.BooleanField(default=False, verbose_name='L – lekarz systemu')
    spec_P   = models.BooleanField(default=False, verbose_name='P – pielęgniarka systemu')
    spec_Ps  = models.BooleanField(default=False, verbose_name='Ps – psycholog')
    spec_R   = models.BooleanField(default=False, verbose_name='R – ratownik')
    spec_Rt  = models.BooleanField(default=False, verbose_name='Rt – ratownictwo techniczne')
    spec_Rch = models.BooleanField(default=False, verbose_name='Rch – ratownictwo chemiczne')
    spec_Re  = models.BooleanField(default=False, verbose_name='Re – ratownictwo ekologiczne')
    spec_Rwo = models.BooleanField(default=False, verbose_name='Rwo – ratownictwo wodne')
    spec_Rwy         = models.BooleanField(default=False, verbose_name='Rwy – ratownictwo wysokościowe')
    years_experience = models.CharField(max_length=100, blank=True, default='', verbose_name='Staż pracy')

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        parts = [p for p in [self.title, self.first_name, self.last_name] if p]
        return ' '.join(parts)

    @property
    def full_name(self):
        return str(self)

    @property
    def specializations(self):
        return [code for code in SPECIALIZATION_CODES if getattr(self, f'spec_{code}')]

    @property
    def specializations_str(self):
        return ', '.join(self.specializations)


class Course(models.Model):
    TYPE_KPP    = 'kpp'
    TYPE_RECERT = 'recert'
    TYPE_CHOICES = [
        (TYPE_KPP,    'Kwalifikowana Pierwsza Pomoc'),
        (TYPE_RECERT, 'Recertyfikacja'),
    ]

    # Podstawowe
    name             = models.CharField(max_length=200)
    course_type      = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_KPP)
    city             = models.CharField(max_length=100, blank=True)
    max_participants = models.PositiveIntegerField(default=0)
    price            = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateField(default=datetime.date.today)

    # Terminy – 6 wybranych dat
    course_days = models.JSONField(default=list)
    start_date  = models.DateField(null=True, blank=True)
    end_date    = models.DateField(null=True, blank=True)

    # Egzamin
    exam_date     = models.DateField(null=True, blank=True)
    exam_time     = models.TimeField(null=True, blank=True)
    exam_location = models.CharField(max_length=300, blank=True)

    # Komunikacja
    whatsapp_link = models.CharField(max_length=500, blank=True)

    # Organizacja
    entity_director   = models.CharField(max_length=200, blank=True)
    academic_director = models.CharField(max_length=200, blank=True)

    # Kadra
    instructors      = models.ManyToManyField(Instructor, blank=True, related_name='courses')
    instructor_order = models.JSONField(default=list)  # ordered list of Instructor PKs

    # Inne osoby
    psychologist      = models.CharField(max_length=200, blank=True)
    committee_chair   = models.CharField(max_length=200, blank=True)
    committee_member1 = models.CharField(max_length=200, blank=True)
    committee_member2 = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['start_date']

    def save(self, *args, **kwargs):
        if self.course_days:
            days = sorted(d for d in self.course_days if d)
            self.start_date = days[0]  if days else None
            self.end_date   = days[-1] if days else None
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.start_date})'

    @property
    def spots_left(self):
        return self.max_participants - self.enrollments.filter(is_deleted=False).count()

    @property
    def is_full(self):
        return self.spots_left <= 0

    @property
    def instructors_count(self):
        return math.ceil(self.max_participants / 6) if self.max_participants else 1


class Enrollment(models.Model):
    course           = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='enrollments')
    user             = models.ForeignKey(
                           get_user_model(), on_delete=models.SET_NULL,
                           null=True, blank=True, related_name='enrollments',
                       )
    first_name       = models.CharField(max_length=100)
    last_name        = models.CharField(max_length=100)
    pesel            = EncryptedCharField(blank=True, default='')
    birth_date       = models.DateField(null=True, blank=True)
    email            = models.EmailField(blank=True, default='')
    phone            = models.CharField(max_length=20, blank=True, default='')
    zip_code         = models.CharField(max_length=6)
    city             = models.CharField(max_length=100)
    street           = models.CharField(max_length=200)
    house_number     = models.CharField(max_length=20)
    apartment_number = models.CharField(max_length=20, blank=True)
    photo_consent    = models.BooleanField(default=False)
    deposit_paid     = models.BooleanField(default=False)
    created_at       = models.DateTimeField(auto_now_add=True)

    # Soft-delete
    is_deleted      = models.BooleanField(default=False)
    deleted_at      = models.DateTimeField(null=True, blank=True)
    deletion_reason = models.CharField(max_length=15, blank=True, choices=[
        ('forfeit',    'Rezygnacja (bez powodu) – zaliczka przepadła'),
        ('refund',     'Rezygnacja z przyczyn losowych – zwrot zaliczki'),
        ('reschedule', 'Rezygnacja z przyczyn losowych – zmiana terminu'),
    ])

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.last_name} {self.first_name} – {self.course}'
