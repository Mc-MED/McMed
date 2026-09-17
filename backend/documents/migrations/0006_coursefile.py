from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0024_course_number'),
        ('documents', '0005_quizprogress'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=200)),
                ('file', models.FileField(upload_to='course_files/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('course', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='uploaded_files',
                    to='courses.course',
                )),
            ],
            options={'ordering': ['uploaded_at']},
        ),
    ]
