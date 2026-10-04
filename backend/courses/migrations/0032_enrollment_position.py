from django.db import migrations, models


def fill_positions(apps, schema_editor):
    """Dotychczasowa kolejność (wg daty zapisu) staje się zapisaną pozycją; usunięci też dostają miejsce."""
    Enrollment = apps.get_model('courses', 'Enrollment')
    counters = {}
    for pk, course_id in (Enrollment.objects.exclude(course__isnull=True)
                          .order_by('created_at', 'id').values_list('id', 'course_id')):
        counters[course_id] = counters.get(course_id, 0) + 1
        Enrollment.objects.filter(pk=pk).update(position=counters[course_id])


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0031_enrollment_committee_practical_scores'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='position',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name='enrollment',
            options={'ordering': ['position', 'created_at']},
        ),
        migrations.RunPython(fill_positions, migrations.RunPython.noop),
    ]
