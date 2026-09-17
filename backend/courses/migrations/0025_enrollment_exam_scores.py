from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0024_course_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='exam_rko',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_zad1',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='enrollment',
            name='exam_zad2',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
    ]
