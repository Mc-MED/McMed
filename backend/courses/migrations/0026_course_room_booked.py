from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0025_enrollment_exam_scores'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='room_booked',
            field=models.BooleanField(default=False),
        ),
    ]
