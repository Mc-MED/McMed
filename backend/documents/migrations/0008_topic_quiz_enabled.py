from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0007_topic_quiz'),
    ]

    operations = [
        migrations.AddField(
            model_name='topic',
            name='quiz_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
