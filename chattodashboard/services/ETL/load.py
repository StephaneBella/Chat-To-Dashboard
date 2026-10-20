
def to_model_columns(model, table):
    """order_date_key -> order_date_id, client_key -> client_id, etc. (via db_column des FK)."""
    rename = {
        f.db_column: f.attname
        for f in model._meta.concrete_fields
        if f.is_relation and f.db_column
    }
    return table.rename(columns=rename)


def load_table(model, table):
    """Insert the table. The emptying is done by run_etl (reverse order, because we have many FK PROTECT)."""
    rows = to_model_columns(model, table).to_dict(orient="records")
    model.objects.bulk_create([model(**row) for row in rows], batch_size=1000)
    return model.objects.count()

