from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('documents', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('order', models.PositiveIntegerField(default=0)),
            ],
            options={'ordering': ['order', 'id']},
        ),
        migrations.CreateModel(
            name='TopicFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('file', models.FileField(upload_to='topic_files/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='documents.topic')),
            ],
            options={'ordering': ['order', 'id']},
        ),
    ]
