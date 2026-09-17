from django.db import migrations, models


def deposit_bool_to_status(apps, schema_editor):
    Enrollment = apps.get_model('courses', 'Enrollment')
    Enrollment.objects.filter(deposit_paid=True).update(payment_status='paid')


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0021_add_cert_fields_to_enrollment'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='payment_status',
            field=models.CharField(
                max_length=10,
                choices=[('none', 'Brak'), ('deposit', 'Zaliczka'), ('paid', 'Opłacony')],
                default='none',
            ),
        ),
        migrations.RunPython(deposit_bool_to_status, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='enrollment',
            name='deposit_paid',
        ),
    ]
