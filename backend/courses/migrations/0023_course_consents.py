from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0022_payment_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='consents_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='course',
            name='consents_received',
            field=models.BooleanField(default=False),
        ),
    ]
