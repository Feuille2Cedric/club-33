"""Export the local club to a private SQL file, without publishing user data."""
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect('file:' + str(root / 'club33.sqlite3') + '?mode=ro', uri=True)
db.row_factory = sqlite3.Row

def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + value.replace("'", "''") + "'"

sql = ['begin;', '''do $$ begin
if exists(select 1 from public.club_albums) or exists(select 1 from public.club_ratings)
or exists(select 1 from public.club_members where id > 3) then
raise exception 'Import only into a freshly initialized Club 33 database';
end if; end $$;''']
for table in ('members', 'albums', 'ratings'):
    for row in db.execute('SELECT * FROM ' + table):
        columns = row.keys()
        statement = 'INSERT INTO public.club_' + table + '(' + ','.join(columns) + ') VALUES (' + ','.join(literal(row[k]) for k in columns) + ')'
        if table == 'members':
            statement += ' ON CONFLICT(id) DO UPDATE SET name=excluded.name'
        sql.append(statement + ';')
for table in ('members', 'albums'):
    sql.append("SELECT setval(pg_get_serial_sequence('public.club_%s','id'),coalesce(max(id),1),count(*)>0) FROM public.club_%s;" % (table, table))
sql.append('commit;')
target = root / 'supabase-import.sql'
target.write_text('\n'.join(sql), encoding='utf-8')
print('Created private local file: supabase-import.sql')
