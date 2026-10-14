def load_table(model, table):
    model.objects.all().delete()
    model.objects.bulk_create([model(**row) for row in table.to_dict(orient="records")])
    return model.objects.count()

