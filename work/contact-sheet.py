from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
files=sorted(Path('public/assets/trainers').glob('*.jpg'))
thumbs=[]
for p in files:
 im=Image.open(p).convert('RGB').resize((280,280),Image.Resampling.LANCZOS)
 tile=Image.new('RGB',(300,330),'#f5f5f5'); tile.paste(im,(10,10)); ImageDraw.Draw(tile).text((10,300),p.name,fill='#111'); thumbs.append(tile)
out=Image.new('RGB',(1200,660),'#ddd')
for i,im in enumerate(thumbs): out.paste(im,((i%4)*300,(i//4)*330))
out.save('work/pdf-review/trainer-crops.jpg',quality=90)
