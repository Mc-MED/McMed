from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0023_course_consents'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='course_number',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
