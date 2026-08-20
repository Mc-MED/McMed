from django.db import migrations
import courses.fields


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0016_course_created_at_editable'),
    ]

    operations = [
        migrations.AlterField(
            model_name='enrollment',
            name='pesel',
            field=courses.fields.EncryptedCharField(blank=True, default=''),
        ),
    ]
