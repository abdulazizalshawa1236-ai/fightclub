from pathlib import Path
p=Path('src/db.js'); s=p.read_text(encoding='utf-8')
count=s.count('\\\\n\\\\n')
if count!=2: raise SystemExit(f'expected two escaped paragraph separators; got {count}')
s=s.replace('\\\\n\\\\n','\\n\\n')
p.write_text(s,encoding='utf-8')
