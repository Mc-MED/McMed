from django.conf import settings
from django.db import models


class Topic(models.Model):
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


class TopicFile(models.Model):
    topic = models.ForeignKey(Topic, related_name='files', on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='topic_files/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


class TopicFileProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='file_progress')
    file = models.ForeignKey(TopicFile, on_delete=models.CASCADE, related_name='completions')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'file')


class CourseFile(models.Model):
    course      = models.ForeignKey('courses.Course', related_name='uploaded_files', on_delete=models.CASCADE)
    label       = models.CharField(max_length=200)
    file        = models.FileField(upload_to='course_files/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return f'{self.label} – kurs {self.course_id}'


class QuizProgress(models.Model):
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quiz_progress')
    category_id = models.CharField(max_length=20)
    last_index  = models.PositiveIntegerField(default=0)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'category_id')
