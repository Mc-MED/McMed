from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0026_course_room_booked'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='certificate_visible',
            field=models.BooleanField(default=False),
        ),
    ]
