from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0027_enrollment_certificate_visible'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='exam_theory_attempt1',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_theory_attempt2',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_theory_grade',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_committee_chair',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_committee_member1',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_committee_member2',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True),
        ),
    ]
